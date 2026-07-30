create table if not exists public.marketplace_order_evidence (
  order_id uuid primary key references public.marketplace_orders(id) on delete restrict,
  payment_session_id uuid references public.marketplace_payment_sessions(id) on delete set null,
  buyer_id uuid not null,
  buyer_snapshot jsonb not null default '{}'::jsonb,
  product_snapshot jsonb not null default '[]'::jsonb,
  legal_documents_snapshot jsonb not null default '[]'::jsonb,
  payment_snapshot jsonb not null default '{}'::jsonb,
  purchase_terms_accepted boolean not null default false,
  purchase_terms_accepted_at timestamptz,
  account_legal_accepted_at timestamptz,
  checkout_ip text,
  checkout_user_agent text,
  checkout_request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_order_evidence_payment_idx
  on public.marketplace_order_evidence (payment_session_id);
create index if not exists marketplace_order_evidence_buyer_idx
  on public.marketplace_order_evidence (buyer_id, created_at desc);

create table if not exists public.marketplace_customer_communications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.marketplace_orders(id) on delete set null,
  payment_session_id uuid references public.marketplace_payment_sessions(id) on delete set null,
  buyer_id uuid not null,
  channel text not null check (channel in ('system', 'email', 'line', 'support')),
  direction text not null check (direction in ('outbound', 'inbound')),
  event_type text not null,
  subject text,
  content text not null,
  recipient_snapshot text,
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists marketplace_customer_communications_order_idx
  on public.marketplace_customer_communications (order_id, occurred_at desc);
create index if not exists marketplace_customer_communications_buyer_idx
  on public.marketplace_customer_communications (buyer_id, occurred_at desc);

create table if not exists public.marketplace_entitlement_usage_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.marketplace_orders(id) on delete set null,
  order_item_id uuid references public.marketplace_order_items(id) on delete set null,
  product_id uuid references public.marketplace_products(id) on delete set null,
  buyer_id uuid not null,
  feature_key text,
  event_type text not null,
  ip_address text,
  user_agent text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists marketplace_entitlement_usage_order_idx
  on public.marketplace_entitlement_usage_events (order_id, occurred_at desc);
create index if not exists marketplace_entitlement_usage_buyer_idx
  on public.marketplace_entitlement_usage_events (buyer_id, occurred_at desc);

alter table public.marketplace_product_downloads
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists request_id text;
alter table public.marketplace_product_views
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists request_id text;

create table if not exists public.marketplace_payment_disputes (
  id uuid primary key default gen_random_uuid(),
  stripe_dispute_id text not null unique,
  stripe_charge_id text,
  stripe_payment_intent_id text,
  payment_session_id uuid references public.marketplace_payment_sessions(id) on delete set null,
  buyer_id uuid,
  amount numeric(12,2) not null default 0,
  currency text not null default 'THB',
  reason text,
  status text not null,
  evidence_due_by timestamptz,
  is_charge_refundable boolean,
  has_liability_shift boolean,
  stripe_evidence_details jsonb not null default '{}'::jsonb,
  raw_snapshot jsonb not null default '{}'::jsonb,
  license_state_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists marketplace_payment_disputes_session_idx
  on public.marketplace_payment_disputes (payment_session_id, created_at desc);
create index if not exists marketplace_payment_disputes_status_idx
  on public.marketplace_payment_disputes (status, evidence_due_by);

alter table public.marketplace_orders
  drop constraint if exists marketplace_orders_status_check;
alter table public.marketplace_orders
  add constraint marketplace_orders_status_check
  check (
    status in (
      'pending', 'pending_payment', 'payment_review', 'payment_rejected',
      'paid', 'completed', 'disputed', 'cancelled', 'refunded'
    )
  );

alter table public.marketplace_payment_sessions
  drop constraint if exists marketplace_payment_sessions_status_check;
alter table public.marketplace_payment_sessions
  add constraint marketplace_payment_sessions_status_check
  check (
    status in (
      'pending_payment', 'payment_review', 'verified', 'disputed',
      'rejected', 'expired'
    )
  );

alter table public.marketplace_school_licenses
  drop constraint if exists marketplace_school_licenses_status_check;
alter table public.marketplace_school_licenses
  add constraint marketplace_school_licenses_status_check
  check (status in ('active', 'renewed', 'expired', 'disputed', 'revoked', 'refunded'));

alter table public.marketplace_user_licenses
  drop constraint if exists marketplace_user_licenses_status_check;
alter table public.marketplace_user_licenses
  add constraint marketplace_user_licenses_status_check
  check (status in ('active', 'renewed', 'expired', 'disputed', 'revoked', 'refunded'));

alter table public.marketplace_ledger_entries
  drop constraint if exists marketplace_ledger_entries_entry_type_check;
alter table public.marketplace_ledger_entries
  add constraint marketplace_ledger_entries_entry_type_check
  check (
    entry_type in (
      'sale', 'commission', 'gateway_fee', 'refund', 'adjustment',
      'chargeback', 'chargeback_reversal'
    )
  );

alter table public.marketplace_order_evidence enable row level security;
alter table public.marketplace_customer_communications enable row level security;
alter table public.marketplace_entitlement_usage_events enable row level security;
alter table public.marketplace_payment_disputes enable row level security;
