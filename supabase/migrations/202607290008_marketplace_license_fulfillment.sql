-- School-targeted, retry-safe Marketplace license fulfillment.

alter table public.marketplace_products
  add column if not exists grants_plan_code text,
  add column if not exists license_max_teachers integer check (license_max_teachers >= 0),
  add column if not exists license_max_students integer check (license_max_students >= 0),
  add column if not exists license_max_school_admins integer check (license_max_school_admins >= 0),
  add column if not exists license_line_quota integer check (license_line_quota >= 0);

alter table public.marketplace_orders
  add column if not exists license_school_id uuid references public.schools(id) on delete restrict;

update public.marketplace_orders orders
set license_school_id = users.school_id
from public.app_users users
where orders.license_school_id is null
  and orders.buyer_id = users.id
  and users.role = 'school_admin';

create index if not exists marketplace_orders_license_school_idx
  on public.marketplace_orders (license_school_id, paid_at desc);

alter table public.marketplace_school_licenses
  add column if not exists grants_plan_code text,
  add column if not exists max_teachers integer check (max_teachers >= 0),
  add column if not exists max_students integer check (max_students >= 0),
  add column if not exists max_school_admins integer check (max_school_admins >= 0),
  add column if not exists line_quota integer check (line_quota >= 0),
  add column if not exists duration_days integer check (duration_days > 0),
  add column if not exists revoked_at timestamptz,
  add column if not exists revoke_reason text,
  add column if not exists renewed_from_license_id uuid
    references public.marketplace_school_licenses(id) on delete set null;

alter table public.marketplace_school_licenses
  drop constraint if exists marketplace_school_licenses_status_check;
alter table public.marketplace_school_licenses
  add constraint marketplace_school_licenses_status_check
  check (status in ('active', 'renewed', 'expired', 'revoked', 'refunded'));

create table if not exists public.marketplace_school_license_events (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.marketplace_school_licenses(id) on delete restrict,
  event_type text not null
    check (event_type in ('created', 'renewed', 'expired', 'revoked', 'refunded')),
  order_id uuid references public.marketplace_orders(id) on delete set null,
  payment_session_id uuid references public.marketplace_payment_sessions(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists marketplace_school_license_events_license_idx
  on public.marketplace_school_license_events (license_id, created_at desc);
alter table public.marketplace_school_license_events enable row level security;

-- Reconcile paid orders that predate fulfillment. order_item_id remains the
-- idempotency key, therefore this block is safe to run repeatedly.
insert into public.marketplace_school_licenses (
  school_id, product_id, order_id, order_item_id, license_scope, feature_keys,
  seat_count, starts_at, expires_at, grants_plan_code, max_teachers,
  max_students, max_school_admins, line_quota, duration_days
)
select
  orders.license_school_id,
  products.id,
  orders.id,
  items.id,
  products.license_scope,
  products.grants_feature_keys,
  case when products.license_scope = 'teacher'
    then products.license_seat_count else 1 end,
  coalesce(orders.paid_at, now()),
  coalesce(orders.paid_at, now())
    + make_interval(days => products.grant_duration_days),
  products.grants_plan_code,
  products.license_max_teachers,
  products.license_max_students,
  products.license_max_school_admins,
  products.license_line_quota,
  products.grant_duration_days
from public.marketplace_order_items items
join public.marketplace_orders orders on orders.id = items.order_id
join public.marketplace_products products on products.id = items.product_id
where orders.status in ('paid', 'completed')
  and orders.license_school_id is not null
  and products.resource_type = 'feature_unlock'
  and cardinality(products.grants_feature_keys) > 0
  and products.grant_duration_days > 0
on conflict (order_item_id) do nothing;

insert into public.marketplace_school_license_events (license_id, event_type, order_id)
select licenses.id, 'created', licenses.order_id
from public.marketplace_school_licenses licenses
where not exists (
  select 1 from public.marketplace_school_license_events events
  where events.license_id = licenses.id and events.event_type = 'created'
);

insert into public.school_feature_purchases (
  school_id, feature_key, expires_at, source_order_id, source_product_id
)
select
  licenses.school_id,
  feature_key,
  max(licenses.expires_at),
  (array_agg(licenses.order_id order by licenses.expires_at desc))[1],
  (array_agg(licenses.product_id order by licenses.expires_at desc))[1]
from public.marketplace_school_licenses licenses
cross join lateral unnest(licenses.feature_keys) feature_key
where licenses.license_scope = 'school'
  and licenses.status = 'active'
  and licenses.expires_at > now()
group by licenses.school_id, feature_key
on conflict (school_id, feature_key) do update
set expires_at = greatest(public.school_feature_purchases.expires_at, excluded.expires_at),
    source_order_id = excluded.source_order_id,
    source_product_id = excluded.source_product_id,
    updated_at = now();
