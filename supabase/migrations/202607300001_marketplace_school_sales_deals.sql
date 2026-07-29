-- Seller-led school quotations and contract acceptance.

create table if not exists public.marketplace_sales_deals (
  id uuid primary key default gen_random_uuid(),
  public_token uuid not null unique default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete restrict,
  product_id uuid not null references public.marketplace_products(id) on delete restrict,
  school_id uuid references public.schools(id) on delete restrict,
  school_name text not null,
  school_code text,
  school_email text not null,
  contact_name text not null,
  contact_position text,
  contact_phone text,
  quantity integer not null default 1 check (quantity > 0),
  list_price numeric(12,2) not null check (list_price >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  negotiated_price numeric(12,2) not null check (negotiated_price >= 0),
  terms_snapshot text not null,
  expires_at timestamptz not null,
  status text not null default 'draft'
    check (status in (
      'draft', 'sent', 'viewed', 'accepted', 'awaiting_payment',
      'paid', 'provisioning', 'active', 'expired', 'cancelled'
    )),
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_sales_deals_seller_idx
  on public.marketplace_sales_deals (seller_id, created_at desc);
create index if not exists marketplace_sales_deals_school_idx
  on public.marketplace_sales_deals (school_id, created_at desc);

create table if not exists public.marketplace_contract_signatures (
  id uuid primary key default gen_random_uuid(),
  sales_deal_id uuid not null unique
    references public.marketplace_sales_deals(id) on delete restrict,
  signer_user_id uuid not null,
  signer_name text not null,
  signer_position text,
  signer_email text,
  terms_accepted boolean not null,
  authority_confirmed boolean not null,
  pdpa_accepted boolean not null,
  signed_ip inet,
  signed_user_agent text,
  signed_at timestamptz not null default now()
);

alter table public.marketplace_orders
  add column if not exists sales_deal_id uuid
    references public.marketplace_sales_deals(id) on delete set null;
create unique index if not exists marketplace_orders_sales_deal_key
  on public.marketplace_orders (sales_deal_id)
  where sales_deal_id is not null;

alter table public.marketplace_sales_deals enable row level security;
alter table public.marketplace_contract_signatures enable row level security;
