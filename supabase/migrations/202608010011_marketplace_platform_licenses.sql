alter table public.marketplace_products
  drop constraint if exists marketplace_products_license_scope_check;
alter table public.marketplace_products
  add constraint marketplace_products_license_scope_check
  check (license_scope in ('individual', 'school', 'teacher', 'platform'));

create table if not exists public.marketplace_platform_licenses (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete restrict,
  order_id uuid not null references public.marketplace_orders(id) on delete restrict,
  order_item_id uuid not null unique references public.marketplace_order_items(id) on delete restrict,
  feature_keys text[] not null default '{}',
  grants_plan_code text,
  duration_days integer not null check (duration_days > 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active'
    check (status in ('active', 'renewed', 'expired', 'disputed', 'revoked', 'refunded')),
  revoked_at timestamptz,
  revoke_reason text,
  renewed_from_license_id uuid
    references public.marketplace_platform_licenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_platform_licenses_expiry_idx
  on public.marketplace_platform_licenses (status, expires_at desc);
create index if not exists marketplace_platform_licenses_product_idx
  on public.marketplace_platform_licenses (product_id, expires_at desc);
create index if not exists marketplace_platform_licenses_features_idx
  on public.marketplace_platform_licenses using gin (feature_keys);

alter table public.marketplace_platform_licenses enable row level security;
