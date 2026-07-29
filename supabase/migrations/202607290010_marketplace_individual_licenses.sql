-- Personal eKru apps can be purchased without a school relationship.

alter table public.subscription_plans
  add column if not exists plan_scope text not null default 'school';
alter table public.subscription_plans
  drop constraint if exists subscription_plans_plan_scope_check;
alter table public.subscription_plans
  add constraint subscription_plans_plan_scope_check
  check (plan_scope in ('school', 'individual'));

alter table public.marketplace_products
  drop constraint if exists marketplace_products_license_scope_check;
alter table public.marketplace_products
  add constraint marketplace_products_license_scope_check
  check (license_scope in ('individual', 'school', 'teacher'));

create table if not exists public.marketplace_user_licenses (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null,
  product_id uuid not null references public.marketplace_products(id) on delete restrict,
  order_id uuid not null references public.marketplace_orders(id) on delete restrict,
  order_item_id uuid not null unique references public.marketplace_order_items(id) on delete restrict,
  feature_keys text[] not null default '{}',
  grants_plan_code text,
  duration_days integer not null check (duration_days > 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active'
    check (status in ('active', 'renewed', 'expired', 'revoked', 'refunded')),
  revoked_at timestamptz,
  revoke_reason text,
  renewed_from_license_id uuid
    references public.marketplace_user_licenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_user_licenses_buyer_idx
  on public.marketplace_user_licenses (buyer_id, expires_at desc);
create index if not exists marketplace_user_licenses_features_idx
  on public.marketplace_user_licenses using gin (feature_keys);

create table if not exists public.marketplace_user_license_events (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.marketplace_user_licenses(id) on delete restrict,
  event_type text not null
    check (event_type in ('created', 'renewed', 'expired', 'revoked', 'refunded')),
  order_id uuid references public.marketplace_orders(id) on delete set null,
  payment_session_id uuid references public.marketplace_payment_sessions(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists marketplace_user_license_events_license_idx
  on public.marketplace_user_license_events (license_id, created_at desc);

alter table public.marketplace_user_licenses enable row level security;
alter table public.marketplace_user_license_events enable row level security;

-- Retry-safe fulfillment for already-paid personal packages.
insert into public.marketplace_user_licenses (
  buyer_id, product_id, order_id, order_item_id, feature_keys,
  grants_plan_code, duration_days, starts_at, expires_at
)
select
  orders.buyer_id,
  products.id,
  orders.id,
  items.id,
  products.grants_feature_keys,
  products.grants_plan_code,
  products.grant_duration_days,
  coalesce(orders.paid_at, now()),
  coalesce(orders.paid_at, now())
    + make_interval(days => products.grant_duration_days)
from public.marketplace_order_items items
join public.marketplace_orders orders on orders.id = items.order_id
join public.marketplace_products products on products.id = items.product_id
where orders.status in ('paid', 'completed')
  and products.resource_type = 'feature_unlock'
  and products.license_scope = 'individual'
  and cardinality(products.grants_feature_keys) > 0
  and products.grant_duration_days > 0
on conflict (order_item_id) do nothing;

insert into public.marketplace_user_license_events (license_id, event_type, order_id)
select licenses.id, 'created', licenses.order_id
from public.marketplace_user_licenses licenses
where not exists (
  select 1 from public.marketplace_user_license_events events
  where events.license_id = licenses.id and events.event_type = 'created'
);
