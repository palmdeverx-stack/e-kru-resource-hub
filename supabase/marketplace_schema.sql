-- eKru Marketplace
-- Run this file once in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.marketplace_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  username text not null,
  email text not null,
  first_name text not null,
  last_name text not null,
  role text not null default 'marketplace_user'
    check (role = 'marketplace_user'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketplace_users_username_lower_key
  on public.marketplace_users (lower(username));

create unique index if not exists marketplace_users_email_lower_key
  on public.marketplace_users (lower(email));

create table if not exists public.marketplace_sellers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique,
  owner_role text not null
    check (owner_role in ('master_admin', 'school_admin', 'teacher', 'student', 'marketplace_user')),
  seller_type text not null
    check (seller_type in ('teacher', 'external', 'organization')),
  display_name text not null,
  bio text,
  contact_email text,
  status text not null default 'active'
    check (status in ('pending', 'active', 'suspended', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  resource_type text not null default 'digital'
    check (resource_type in ('digital', 'physical', 'service')),
  price numeric(12, 2) not null default 0 check (price >= 0),
  currency text not null default 'THB',
  cover_url text,
  file_url text,
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_products_status_created_idx
  on public.marketplace_products (status, created_at desc);

create index if not exists marketplace_products_seller_idx
  on public.marketplace_products (seller_id, created_at desc);

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null,
  seller_id uuid not null references public.marketplace_sellers(id),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'completed', 'cancelled', 'refunded')),
  total numeric(12, 2) not null check (total >= 0),
  currency text not null default 'THB',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  product_id uuid not null references public.marketplace_products(id),
  title text not null,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  quantity integer not null default 1 check (quantity > 0)
);

alter table public.marketplace_users enable row level security;
alter table public.marketplace_sellers enable row level security;
alter table public.marketplace_products enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_order_items enable row level security;

-- Application APIs use the server-only service role. No anonymous table writes
-- are allowed; public product reads are intentionally exposed through the API.
