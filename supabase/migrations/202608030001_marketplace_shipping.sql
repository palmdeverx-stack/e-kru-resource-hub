create table if not exists public.marketplace_shipping_settings (
  id text primary key default 'default' check (id = 'default'),
  is_enabled boolean not null default false,
  provider text not null default 'shippop' check (provider in ('shippop')),
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.marketplace_shipping_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.marketplace_products
  add column if not exists shipping_weight_grams integer check (shipping_weight_grams > 0),
  add column if not exists shipping_width_cm numeric(8, 2) check (shipping_width_cm > 0),
  add column if not exists shipping_length_cm numeric(8, 2) check (shipping_length_cm > 0),
  add column if not exists shipping_height_cm numeric(8, 2) check (shipping_height_cm > 0);

alter table public.marketplace_sellers
  add column if not exists shipping_contact_name text,
  add column if not exists shipping_phone text,
  add column if not exists shipping_address_line text,
  add column if not exists shipping_subdistrict text,
  add column if not exists shipping_district text,
  add column if not exists shipping_province text,
  add column if not exists shipping_postal_code text;

create table if not exists public.marketplace_shipping_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  label text not null default 'ที่อยู่หลัก',
  recipient_name text not null,
  phone text not null,
  address_line text not null,
  subdistrict text not null,
  district text not null,
  province text not null,
  postal_code text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_shipping_addresses_user_idx
  on public.marketplace_shipping_addresses (user_id, updated_at desc);
create unique index if not exists marketplace_shipping_addresses_one_default_idx
  on public.marketplace_shipping_addresses (user_id) where is_default;

alter table public.marketplace_orders
  add column if not exists shipping_amount numeric(12, 2) not null default 0 check (shipping_amount >= 0),
  add column if not exists shipping_address_snapshot jsonb,
  add column if not exists shipping_quote_snapshot jsonb;

create table if not exists public.marketplace_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.marketplace_orders(id) on delete cascade,
  seller_id uuid not null references public.marketplace_sellers(id),
  buyer_id uuid not null,
  provider text not null default 'shippop' check (provider in ('shippop')),
  provider_order_id text unique,
  tracking_code text,
  courier_tracking_code text,
  courier_code text not null,
  courier_name text not null,
  service_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'booking', 'shipping', 'complete', 'problem', 'return', 'cancelled')),
  shipping_fee numeric(12, 2) not null check (shipping_fee >= 0),
  provider_fee numeric(12, 2) check (provider_fee is null or provider_fee >= 0),
  payment_fee_allocated numeric(12, 2) not null default 0 check (payment_fee_allocated >= 0),
  refunded_amount numeric(12, 2) not null default 0 check (refunded_amount >= 0),
  reconciliation_status text not null default 'pending'
    check (reconciliation_status in ('pending', 'matched', 'difference', 'refunded')),
  reconciled_at timestamptz,
  reconciled_by uuid,
  label_url text,
  quote_snapshot jsonb not null,
  sender_snapshot jsonb not null,
  receiver_snapshot jsonb not null,
  package_snapshot jsonb not null,
  idempotency_key text not null unique,
  booked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- `create table if not exists` does not add newly introduced columns when an
-- earlier version of the shipping migration has already created the table.
-- Keep this upgrade block so the migration is safe to rerun on those projects.
alter table public.marketplace_shipments
  add column if not exists provider_fee numeric(12, 2) check (provider_fee is null or provider_fee >= 0),
  add column if not exists payment_fee_allocated numeric(12, 2) not null default 0 check (payment_fee_allocated >= 0),
  add column if not exists refunded_amount numeric(12, 2) not null default 0 check (refunded_amount >= 0),
  add column if not exists reconciliation_status text not null default 'pending'
    check (reconciliation_status in ('pending', 'matched', 'difference', 'refunded')),
  add column if not exists reconciled_at timestamptz,
  add column if not exists reconciled_by uuid;

create index if not exists marketplace_shipments_seller_idx
  on public.marketplace_shipments (seller_id, created_at desc);
create index if not exists marketplace_shipments_buyer_idx
  on public.marketplace_shipments (buyer_id, created_at desc);
create index if not exists marketplace_shipments_tracking_idx
  on public.marketplace_shipments (tracking_code) where tracking_code is not null;
create index if not exists marketplace_shipments_courier_tracking_idx
  on public.marketplace_shipments (courier_tracking_code) where courier_tracking_code is not null;

create table if not exists public.marketplace_shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.marketplace_shipments(id) on delete cascade,
  provider_event_id text unique,
  status text not null,
  message text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists marketplace_shipment_events_shipment_idx
  on public.marketplace_shipment_events (shipment_id, occurred_at desc);

create table if not exists public.marketplace_shipping_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.marketplace_shipments(id) on delete cascade,
  order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  entry_type text not null
    check (entry_type in ('customer_charge', 'provider_charge', 'payment_fee', 'customer_refund', 'adjustment')),
  amount numeric(12, 2) not null,
  currency text not null default 'THB',
  reference text,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists marketplace_shipping_ledger_shipment_idx
  on public.marketplace_shipping_ledger_entries (shipment_id, occurred_at desc);
create index if not exists marketplace_shipping_ledger_order_idx
  on public.marketplace_shipping_ledger_entries (order_id, occurred_at desc);
create index if not exists marketplace_shipping_ledger_type_idx
  on public.marketplace_shipping_ledger_entries (entry_type, occurred_at desc);

create or replace function public.marketplace_shipping_finance_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'collected', coalesce((select sum(amount) from public.marketplace_shipping_ledger_entries where entry_type = 'customer_charge'), 0),
    'providerCost', abs(coalesce((select sum(amount) from public.marketplace_shipping_ledger_entries where entry_type = 'provider_charge'), 0)),
    'paymentFee', abs(coalesce((select sum(amount) from public.marketplace_shipping_ledger_entries where entry_type = 'payment_fee'), 0)),
    'refunds', abs(coalesce((select sum(amount) from public.marketplace_shipping_ledger_entries where entry_type = 'customer_refund'), 0)),
    'adjustments', coalesce((select sum(amount) from public.marketplace_shipping_ledger_entries where entry_type = 'adjustment'), 0),
    'balance', coalesce((select sum(amount) from public.marketplace_shipping_ledger_entries), 0),
    'pendingReconciliation', (select count(*) from public.marketplace_shipments where reconciliation_status = 'pending'),
    'differences', (select count(*) from public.marketplace_shipments where reconciliation_status = 'difference'),
    'shipmentCount', (select count(*) from public.marketplace_shipments)
  );
$$;
revoke all on function public.marketplace_shipping_finance_summary() from public;
revoke all on function public.marketplace_shipping_finance_summary() from anon;
revoke all on function public.marketplace_shipping_finance_summary() from authenticated;
grant execute on function public.marketplace_shipping_finance_summary() to service_role;

alter table public.marketplace_shipping_settings enable row level security;
alter table public.marketplace_shipping_addresses enable row level security;
alter table public.marketplace_shipments enable row level security;
alter table public.marketplace_shipment_events enable row level security;
alter table public.marketplace_shipping_ledger_entries enable row level security;
