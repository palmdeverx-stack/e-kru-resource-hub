alter table public.marketplace_products
  add column if not exists license_billing_cycle text not null default 'one_time';

alter table public.marketplace_products
  drop constraint if exists marketplace_products_license_billing_cycle_check;
alter table public.marketplace_products
  add constraint marketplace_products_license_billing_cycle_check
  check (license_billing_cycle in ('one_time', 'monthly', 'yearly', 'contract'));

alter table public.marketplace_payment_sessions
  add column if not exists stripe_invoice_id text,
  add column if not exists stripe_subscription_id text;

create unique index if not exists marketplace_payment_stripe_invoice_key
  on public.marketplace_payment_sessions (stripe_invoice_id)
  where stripe_invoice_id is not null;

create table if not exists public.marketplace_license_subscriptions (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null,
  product_id uuid not null references public.marketplace_products(id) on delete restrict,
  seller_id uuid not null references public.marketplace_sellers(id) on delete restrict,
  initial_order_id uuid not null unique references public.marketplace_orders(id) on delete restrict,
  license_school_id uuid references public.schools(id) on delete restrict,
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  amount numeric(12,2) not null check (amount >= 10),
  currency text not null default 'THB',
  stripe_checkout_session_id text not null unique,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null default 'incomplete'
    check (status in ('incomplete', 'active', 'past_due', 'unpaid', 'paused', 'canceled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  last_invoice_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_license_subscriptions_buyer_idx
  on public.marketplace_license_subscriptions (buyer_id, status, current_period_end desc);
create index if not exists marketplace_license_subscriptions_product_idx
  on public.marketplace_license_subscriptions (product_id, status);

alter table public.marketplace_license_subscriptions enable row level security;
