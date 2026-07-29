-- Super Admin-managed receipts for verified Marketplace payments.
-- Financial and party data is snapshotted so an issued receipt remains stable.

create table if not exists public.marketplace_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_session_id uuid not null unique
    references public.marketplace_payment_sessions(id) on delete restrict,
  receipt_number text not null unique,
  status text not null default 'issued'
    check (status in ('issued', 'void')),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'THB',
  payment_method text not null
    check (payment_method in ('promptpay', 'stripe', 'free')),
  transaction_reference text,
  items_snapshot jsonb not null default '[]'::jsonb,
  buyer_id uuid not null,
  buyer_name text not null,
  buyer_email text,
  buyer_tax_id text,
  buyer_address text,
  provider_name text not null,
  provider_tax_id text,
  provider_address text,
  provider_email text,
  notes text,
  issued_at timestamptz not null default now(),
  issued_by uuid not null,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_receipts_status_issued_idx
  on public.marketplace_receipts (status, issued_at desc);
create index if not exists marketplace_receipts_buyer_idx
  on public.marketplace_receipts (buyer_id, issued_at desc);

alter table public.marketplace_receipts enable row level security;

