alter table public.marketplace_products
  add column if not exists license_scope text not null default 'school'
    check (license_scope in ('school', 'teacher'));
alter table public.marketplace_products
  add column if not exists license_seat_count integer not null default 1
    check (license_seat_count > 0);
alter table public.marketplace_products
  add column if not exists grants_feature_keys text[] not null default '{}';

update public.marketplace_products
set grants_feature_keys = array[grants_feature_key]
where grants_feature_key is not null
  and cardinality(grants_feature_keys) = 0;

create table if not exists public.marketplace_school_licenses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  product_id uuid not null references public.marketplace_products(id) on delete restrict,
  order_id uuid not null references public.marketplace_orders(id) on delete restrict,
  order_item_id uuid not null unique references public.marketplace_order_items(id) on delete restrict,
  license_scope text not null check (license_scope in ('school', 'teacher')),
  feature_keys text[] not null default '{}',
  seat_count integer not null default 1 check (seat_count > 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_school_licenses_school_idx
  on public.marketplace_school_licenses (school_id, expires_at desc);
create index if not exists marketplace_school_licenses_features_idx
  on public.marketplace_school_licenses using gin (feature_keys);

create table if not exists public.marketplace_teacher_license_assignments (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.marketplace_school_licenses(id) on delete cascade,
  teacher_id uuid not null,
  assigned_by uuid not null,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists marketplace_teacher_license_assignments_active_key
  on public.marketplace_teacher_license_assignments (license_id, teacher_id)
  where revoked_at is null;
create index if not exists marketplace_teacher_license_assignments_teacher_idx
  on public.marketplace_teacher_license_assignments (teacher_id)
  where revoked_at is null;

alter table public.marketplace_school_licenses enable row level security;
alter table public.marketplace_teacher_license_assignments enable row level security;
