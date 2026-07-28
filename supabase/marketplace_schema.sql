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

create table if not exists public.marketplace_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketplace_categories_name_lower_key
  on public.marketplace_categories (lower(name));

insert into public.marketplace_categories (name, sort_order)
values
  ('แผนการสอน', 10),
  ('ใบงาน', 20),
  ('สื่อประกอบ', 30),
  ('แบบทดสอบ', 40),
  ('คอร์สเรียน', 50)
on conflict do nothing;

create table if not exists public.marketplace_media_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  delivery_mode text not null default 'digital'
    check (delivery_mode in ('digital', 'physical', 'service')),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketplace_media_types_code_lower_key
  on public.marketplace_media_types (lower(code));
create unique index if not exists marketplace_media_types_name_lower_key
  on public.marketplace_media_types (lower(name));

insert into public.marketplace_media_types (code, name, delivery_mode, sort_order)
values
  ('digital', 'ไฟล์ดิจิทัล', 'digital', 10),
  ('physical', 'สินค้าจัดส่ง', 'physical', 20),
  ('service', 'บริการ / คอร์ส', 'service', 30)
on conflict do nothing;

create table if not exists public.marketplace_sale_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  pricing_mode text not null default 'paid'
    check (pricing_mode in ('free', 'paid')),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketplace_sale_types_code_lower_key
  on public.marketplace_sale_types (lower(code));
create unique index if not exists marketplace_sale_types_name_lower_key
  on public.marketplace_sale_types (lower(name));

insert into public.marketplace_sale_types (code, name, pricing_mode, sort_order)
values
  ('free', 'แจกฟรี', 'free', 10),
  ('paid', 'จำหน่ายแบบมีค่าใช้จ่าย', 'paid', 20)
on conflict do nothing;

create table if not exists public.marketplace_media_review_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  review_scope text not null default 'content'
    check (review_scope in ('content', 'file', 'rights')),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketplace_media_review_rules_code_lower_key
  on public.marketplace_media_review_rules (lower(code));
create unique index if not exists marketplace_media_review_rules_name_lower_key
  on public.marketplace_media_review_rules (lower(name));

insert into public.marketplace_media_review_rules
  (code, name, description, review_scope, sort_order)
values
  ('content_quality', 'คุณภาพและความถูกต้องของเนื้อหา', 'ตรวจความถูกต้อง ความครบถ้วน และความเหมาะสมทางการศึกษา', 'content', 10),
  ('file_quality', 'คุณภาพและความปลอดภัยของไฟล์', 'ตรวจว่าไฟล์เปิดได้ ไม่มีมัลแวร์ และตรงกับรายละเอียดสินค้า', 'file', 20),
  ('copyright', 'ลิขสิทธิ์และสิทธิ์การใช้งาน', 'ตรวจเจ้าของผลงาน แหล่งอ้างอิง และสิทธิ์ในการจำหน่าย', 'rights', 30)
on conflict do nothing;

create table if not exists public.marketplace_order_finance_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  finance_scope text not null default 'order'
    check (finance_scope in ('order', 'payment', 'finance')),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketplace_order_finance_types_code_lower_key
  on public.marketplace_order_finance_types (lower(code));
create unique index if not exists marketplace_order_finance_types_name_lower_key
  on public.marketplace_order_finance_types (lower(name));

insert into public.marketplace_order_finance_types
  (code, name, description, finance_scope, sort_order)
values
  ('order_management', 'การจัดการคำสั่งซื้อ', 'สถานะและการดำเนินการเกี่ยวกับคำสั่งซื้อ', 'order', 10),
  ('payment_management', 'การรับชำระเงิน', 'ช่องทางและการตรวจสอบการชำระเงิน', 'payment', 20),
  ('seller_payout', 'การจ่ายเงินให้ผู้ขาย', 'รอบการจ่าย ค่าธรรมเนียม และรายการโอนเงิน', 'finance', 30)
on conflict do nothing;

create table if not exists public.marketplace_report_reasons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  reason_scope text not null default 'product'
    check (reason_scope in ('product', 'review', 'seller')),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketplace_report_reasons_code_lower_key
  on public.marketplace_report_reasons (lower(code));
create unique index if not exists marketplace_report_reasons_name_lower_key
  on public.marketplace_report_reasons (lower(name));

insert into public.marketplace_report_reasons
  (code, name, reason_scope, sort_order)
values
  ('copyright_violation', 'ละเมิดลิขสิทธิ์', 'product', 10),
  ('inappropriate_content', 'เนื้อหาไม่เหมาะสม', 'product', 20),
  ('false_information', 'ข้อมูลเท็จ', 'product', 30),
  ('broken_file', 'ไฟล์เสีย', 'product', 40),
  ('misleading_media', 'สื่อไม่ตรงปก', 'product', 50),
  ('duplicate_content', 'เนื้อหาซ้ำ', 'product', 60),
  ('personal_information', 'มีข้อมูลส่วนบุคคล', 'product', 70),
  ('fraud', 'หลอกลวง', 'product', 80),
  ('spam', 'สแปม', 'product', 90)
on conflict do nothing;

create table if not exists public.marketplace_line_settings (
  id text primary key default 'default' check (id = 'default'),
  channel_id text,
  channel_secret_encrypted text,
  channel_access_token_encrypted text,
  oa_basic_id text,
  webhook_url text,
  line_user_id text,
  line_display_name text,
  line_linked_at timestamptz,
  is_enabled boolean not null default false,
  notify_new_seller boolean not null default true,
  notify_product_approval boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_line_link_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_line_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('new_seller', 'product_approval')),
  source_id uuid,
  message_text text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  line_user_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists marketplace_line_deliveries_created_idx
  on public.marketplace_line_deliveries (created_at desc);

create table if not exists public.marketplace_email_verifications (
  user_id uuid primary key references public.marketplace_users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  last_sent_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

alter table public.marketplace_sellers
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists rejection_reason text,
  add column if not exists display_name_en text,
  add column if not exists slug text,
  add column if not exists logo_url text,
  add column if not exists cover_url text,
  add column if not exists seller_name text,
  add column if not exists phone text,
  add column if not exists national_tax_id text,
  add column if not exists company_name text,
  add column if not exists company_registration_no text,
  add column if not exists company_tax_id text,
  add column if not exists wizard_step integer not null default 1,
  add column if not exists seller_agreement_accepted_at timestamptz,
  add column if not exists copyright_confirmed_at timestamptz,
  add column if not exists fee_agreement_accepted_at timestamptz,
  add column if not exists pdpa_accepted_at timestamptz;

alter table public.marketplace_sellers
  drop constraint if exists marketplace_sellers_seller_type_check;
update public.marketplace_sellers set seller_type = 'individual' where seller_type = 'external';
update public.marketplace_sellers set seller_type = 'company' where seller_type = 'organization';
alter table public.marketplace_sellers
  add constraint marketplace_sellers_seller_type_check
  check (seller_type in ('individual', 'teacher', 'school', 'company', 'publisher', 'university'));

alter table public.marketplace_sellers
  drop constraint if exists marketplace_sellers_status_check;
alter table public.marketplace_sellers
  add constraint marketplace_sellers_status_check
  check (status in ('draft', 'pending', 'active', 'suspended', 'rejected'));

create unique index if not exists marketplace_sellers_slug_lower_key
  on public.marketplace_sellers (lower(slug))
  where slug is not null;

update public.marketplace_sellers
set submitted_at = coalesce(submitted_at, created_at)
where submitted_at is null
  and status <> 'draft';

create index if not exists marketplace_sellers_status_submitted_idx
  on public.marketplace_sellers (status, submitted_at desc);

create table if not exists public.marketplace_seller_documents (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  document_type text not null
    check (document_type in (
      'store_logo', 'store_cover', 'identity_card', 'bank_book',
      'company_certificate', 'vat_certificate'
    )),
  storage_bucket text not null
    check (storage_bucket in ('marketplace-seller-assets', 'marketplace-seller-documents')),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size integer not null check (file_size > 0),
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, document_type)
);

create index if not exists marketplace_seller_documents_seller_idx
  on public.marketplace_seller_documents (seller_id);

create table if not exists public.marketplace_products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  media_type_id uuid references public.marketplace_media_types(id),
  sale_type_id uuid references public.marketplace_sale_types(id),
  resource_type text not null default 'digital'
    check (resource_type in ('digital', 'physical', 'service')),
  price numeric(12, 2) not null default 0 check (price >= 0),
  currency text not null default 'THB',
  cover_url text,
  file_url text,
  status text not null default 'pending_review'
    check (status in ('draft', 'pending_review', 'published', 'rejected', 'archived')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_products_status_created_idx
  on public.marketplace_products (status, created_at desc);

create index if not exists marketplace_products_seller_idx
  on public.marketplace_products (seller_id, created_at desc);

alter table public.marketplace_products
  add column if not exists media_type_id uuid references public.marketplace_media_types(id);
alter table public.marketplace_products
  add column if not exists sale_type_id uuid references public.marketplace_sale_types(id);
alter table public.marketplace_products
  add column if not exists submitted_at timestamptz;
alter table public.marketplace_products
  add column if not exists reviewed_at timestamptz;
alter table public.marketplace_products
  add column if not exists reviewed_by uuid;
alter table public.marketplace_products
  add column if not exists rejection_reason text;

alter table public.marketplace_products
  drop constraint if exists marketplace_products_status_check;
alter table public.marketplace_products
  add constraint marketplace_products_status_check
  check (status in ('draft', 'pending_review', 'published', 'rejected', 'archived'));

update public.marketplace_products product
set media_type_id = media.id
from public.marketplace_media_types media
where product.media_type_id is null
  and media.code = product.resource_type;

update public.marketplace_products product
set sale_type_id = sale.id
from public.marketplace_sale_types sale
where product.sale_type_id is null
  and sale.pricing_mode = case when product.price = 0 then 'free' else 'paid' end;

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

-- Each seller connects their own LINE Official Account credentials. Access tokens
-- are encrypted by the application before they reach this table.
create table if not exists public.marketplace_seller_line_settings (
  seller_id uuid primary key references public.marketplace_sellers(id) on delete cascade,
  channel_access_token_encrypted text,
  line_user_id text,
  is_enabled boolean not null default false,
  notify_payment_received boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_seller_line_deliveries (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  order_id uuid references public.marketplace_orders(id) on delete cascade,
  payment_session_id uuid,
  event_type text not null default 'payment_received'
    check (event_type in ('payment_received', 'test')),
  amount numeric(12, 2),
  message_text text not null,
  status text not null check (status in ('sent', 'failed')),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create unique index if not exists marketplace_seller_line_delivery_order_event_key
  on public.marketplace_seller_line_deliveries (order_id, event_type)
  where order_id is not null;
create index if not exists marketplace_seller_line_deliveries_seller_created_idx
  on public.marketplace_seller_line_deliveries (seller_id, created_at desc);

-- Manual PromptPay payment, platform fees, seller balances and payouts.
create table if not exists public.marketplace_finance_settings (
  id text primary key default 'default' check (id = 'default'),
  promptpay_id text,
  promptpay_account_name text,
  commission_rate numeric(5, 2) not null default 10
    check (commission_rate >= 0 and commission_rate <= 100),
  hold_days integer not null default 7 check (hold_days >= 0 and hold_days <= 90),
  payout_day integer not null default 5 check (payout_day >= 0 and payout_day <= 6),
  minimum_payout numeric(12, 2) not null default 100 check (minimum_payout >= 0),
  stripe_enabled boolean not null default false,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.marketplace_finance_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.marketplace_finance_settings
  add column if not exists stripe_enabled boolean not null default false;

create table if not exists public.marketplace_payment_sessions (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'THB',
  payment_method text not null default 'promptpay'
    check (payment_method in ('promptpay', 'stripe', 'free')),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'payment_review', 'verified', 'rejected', 'expired')),
  promptpay_id_snapshot text,
  account_name_snapshot text,
  slip_path text,
  slip_file_name text,
  slip_mime_type text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  bank_transaction_reference text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_checkout_url text,
  processor_fee numeric(12, 2) not null default 0 check (processor_fee >= 0),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketplace_payment_sessions
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_checkout_url text,
  add column if not exists processor_fee numeric(12, 2) not null default 0;

alter table public.marketplace_payment_sessions
  drop constraint if exists marketplace_payment_sessions_payment_method_check;
alter table public.marketplace_payment_sessions
  add constraint marketplace_payment_sessions_payment_method_check
  check (payment_method in ('promptpay', 'stripe', 'free'));

create unique index if not exists marketplace_payment_stripe_session_key
  on public.marketplace_payment_sessions (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create unique index if not exists marketplace_payment_stripe_intent_key
  on public.marketplace_payment_sessions (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists marketplace_payment_bank_reference_key
  on public.marketplace_payment_sessions (bank_transaction_reference)
  where bank_transaction_reference is not null;
create index if not exists marketplace_payment_sessions_buyer_created_idx
  on public.marketplace_payment_sessions (buyer_id, created_at desc);
create index if not exists marketplace_payment_sessions_status_submitted_idx
  on public.marketplace_payment_sessions (status, submitted_at desc);

alter table public.marketplace_orders
  add column if not exists payment_session_id uuid
    references public.marketplace_payment_sessions(id) on delete set null,
  add column if not exists gross_amount numeric(12, 2),
  add column if not exists discount_amount numeric(12, 2) not null default 0,
  add column if not exists commission_rate numeric(5, 2) not null default 0,
  add column if not exists platform_fee numeric(12, 2) not null default 0,
  add column if not exists payment_fee numeric(12, 2) not null default 0,
  add column if not exists seller_net numeric(12, 2),
  add column if not exists paid_at timestamptz,
  add column if not exists available_at timestamptz;

update public.marketplace_orders
set gross_amount = coalesce(gross_amount, total),
    seller_net = coalesce(seller_net, total - platform_fee - payment_fee)
where gross_amount is null or seller_net is null;

alter table public.marketplace_orders
  alter column gross_amount set not null,
  alter column seller_net set not null;

alter table public.marketplace_orders
  drop constraint if exists marketplace_orders_status_check;
alter table public.marketplace_orders
  add constraint marketplace_orders_status_check
  check (
    status in (
      'pending', 'pending_payment', 'payment_review', 'payment_rejected',
      'paid', 'completed', 'cancelled', 'refunded'
    )
  );

create index if not exists marketplace_orders_payment_session_idx
  on public.marketplace_orders (payment_session_id);
create index if not exists marketplace_orders_seller_available_idx
  on public.marketplace_orders (seller_id, available_at)
  where status in ('paid', 'completed');

create table if not exists public.marketplace_seller_payout_accounts (
  seller_id uuid primary key references public.marketplace_sellers(id) on delete cascade,
  bank_code text not null,
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  promptpay_id text,
  is_verified boolean not null default false,
  verified_at timestamptz,
  verified_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'THB',
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  bank_code_snapshot text not null,
  bank_name_snapshot text not null,
  account_number_snapshot text not null,
  account_name_snapshot text not null,
  transfer_reference text,
  failure_reason text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketplace_payout_transfer_reference_key
  on public.marketplace_payouts (transfer_reference)
  where transfer_reference is not null;
create index if not exists marketplace_payouts_seller_created_idx
  on public.marketplace_payouts (seller_id, created_at desc);
create index if not exists marketplace_payouts_status_created_idx
  on public.marketplace_payouts (status, created_at desc);

create table if not exists public.marketplace_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id),
  seller_id uuid references public.marketplace_sellers(id),
  payout_id uuid references public.marketplace_payouts(id) on delete set null,
  account_scope text not null check (account_scope in ('seller', 'platform')),
  entry_type text not null
    check (entry_type in ('sale', 'commission', 'gateway_fee', 'refund', 'adjustment')),
  amount numeric(12, 2) not null,
  currency text not null default 'THB',
  description text,
  available_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.marketplace_ledger_entries
  drop constraint if exists marketplace_ledger_entries_entry_type_check;
alter table public.marketplace_ledger_entries
  add constraint marketplace_ledger_entries_entry_type_check
  check (entry_type in ('sale', 'commission', 'gateway_fee', 'refund', 'adjustment'));

create unique index if not exists marketplace_ledger_order_scope_type_key
  on public.marketplace_ledger_entries (order_id, account_scope, entry_type);
create index if not exists marketplace_ledger_seller_available_idx
  on public.marketplace_ledger_entries (seller_id, available_at)
  where account_scope = 'seller' and payout_id is null;
create index if not exists marketplace_ledger_payout_idx
  on public.marketplace_ledger_entries (payout_id);

create table if not exists public.marketplace_stripe_events (
  event_id text primary key,
  event_type text not null,
  payment_session_id uuid references public.marketplace_payment_sessions(id) on delete set null,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'failed', 'ignored')),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_stripe_events_created_idx
  on public.marketplace_stripe_events (created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketplace-payment-slips',
  'marketplace-payment-slips',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'marketplace-seller-assets',
    'marketplace-seller-assets',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'marketplace-seller-documents',
    'marketplace-seller-documents',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.marketplace_users enable row level security;
alter table public.marketplace_categories enable row level security;
alter table public.marketplace_media_types enable row level security;
alter table public.marketplace_sale_types enable row level security;
alter table public.marketplace_media_review_rules enable row level security;
alter table public.marketplace_order_finance_types enable row level security;
alter table public.marketplace_report_reasons enable row level security;
alter table public.marketplace_line_settings enable row level security;
alter table public.marketplace_line_link_tokens enable row level security;
alter table public.marketplace_line_deliveries enable row level security;

-- Marketplace notifications target master admins who are not tied to a school.
alter table if exists public.notifications
  alter column school_id drop not null;
alter table public.marketplace_email_verifications enable row level security;
alter table public.marketplace_sellers enable row level security;
alter table public.marketplace_seller_documents enable row level security;
alter table public.marketplace_products enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_order_items enable row level security;
alter table public.marketplace_seller_line_settings enable row level security;
alter table public.marketplace_seller_line_deliveries enable row level security;
alter table public.marketplace_finance_settings enable row level security;
alter table public.marketplace_payment_sessions enable row level security;
alter table public.marketplace_seller_payout_accounts enable row level security;
alter table public.marketplace_payouts enable row level security;
alter table public.marketplace_ledger_entries enable row level security;
alter table public.marketplace_stripe_events enable row level security;

-- Application APIs use the server-only service role. No anonymous table writes
-- are allowed; public product reads are intentionally exposed through the API.
