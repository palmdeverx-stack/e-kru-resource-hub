-- E-KRU Marketplace
-- Run this file once in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.marketplace_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  username text not null,
  email text not null,
  display_name text,
  first_name text not null,
  last_name text not null,
  role text not null default 'marketplace_user'
    check (role = 'marketplace_user'),
  is_active boolean not null default true,
  is_suspended boolean not null default false,
  suspended_at timestamptz,
  suspended_by uuid,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketplace_users
  add column if not exists display_name text,
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid,
  add column if not exists suspended_reason text;

update public.marketplace_users
set display_name = trim(concat_ws(' ', first_name, last_name))
where display_name is null or trim(display_name) = '';

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
  created_by uuid,
  first_used_at timestamptz,
  expires_at timestamptz,
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

alter table public.marketplace_media_types
  drop constraint if exists marketplace_media_types_delivery_mode_check;
alter table public.marketplace_media_types
  add constraint marketplace_media_types_delivery_mode_check
  check (delivery_mode in ('digital', 'physical', 'service', 'feature_unlock'));

insert into public.marketplace_media_types (code, name, delivery_mode, sort_order)
values ('feature-unlock', 'ปลดล็อกฟีเจอร์ระบบ', 'feature_unlock', 40)
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

create table if not exists public.marketplace_grade_levels (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketplace_grade_levels_code_lower_key
  on public.marketplace_grade_levels (lower(code));
create unique index if not exists marketplace_grade_levels_name_lower_key
  on public.marketplace_grade_levels (lower(name));

insert into public.marketplace_grade_levels (code, name, sort_order)
values
  ('k1', 'อ.1', 1), ('k2', 'อ.2', 2), ('k3', 'อ.3', 3),
  ('p1', 'ป.1', 10), ('p2', 'ป.2', 20), ('p3', 'ป.3', 30),
  ('p4', 'ป.4', 40), ('p5', 'ป.5', 50), ('p6', 'ป.6', 60),
  ('m1', 'ม.1', 70), ('m2', 'ม.2', 80), ('m3', 'ม.3', 90),
  ('m4', 'ม.4', 100), ('m5', 'ม.5', 110), ('m6', 'ม.6', 120)
on conflict do nothing;

create table if not exists public.marketplace_curricula (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketplace_curricula_code_lower_key
  on public.marketplace_curricula (lower(code));
create unique index if not exists marketplace_curricula_name_lower_key
  on public.marketplace_curricula (lower(name));

insert into public.marketplace_curricula (code, name, sort_order)
values
  ('core-2551-2560', 'หลักสูตรแกนกลาง 2551 (ปรับปรุง 2560)', 10),
  ('school-based', 'หลักสูตรสถานศึกษา', 20),
  ('other', 'อื่นๆ', 30)
on conflict do nothing;

create table if not exists public.marketplace_tags (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketplace_tags_code_lower_key
  on public.marketplace_tags (lower(code));
create unique index if not exists marketplace_tags_name_lower_key
  on public.marketplace_tags (lower(name));
create index if not exists marketplace_tags_unused_expiry_idx
  on public.marketplace_tags (expires_at)
  where created_by is not null and first_used_at is null;

insert into public.marketplace_tags (code, name, sort_order)
values
  ('stem', 'STEM', 10),
  ('active-learning', 'Active Learning', 20),
  ('pbl', 'PBL', 30),
  ('game', 'เกม', 40),
  ('exam-prep', 'สอบเข้า', 50)
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
  allow_seller_notifications boolean not null default false,
  seller_notification_price numeric(12, 2) not null default 99
    check (seller_notification_price >= 10),
  seller_byoa_description text not null
    default 'ใช้ LINE OA ของตัวเอง กรอก Channel token และ User ID เอง',
  seller_managed_price numeric(12, 2) not null default 99
    check (seller_managed_price >= 10),
  seller_managed_description text not null
    default 'ใช้ LINE OA ของระบบ E-KRU ไม่ต้องกรอก Channel token',
  seller_managed_quota integer not null default 100
    check (seller_managed_quota > 0),
  seller_trial_description text not null
    default 'ทดลองใช้ LINE แจ้งเตือนผ่าน OA ของระบบ E-KRU ฟรี 7 วัน',
  seller_trial_days integer not null default 7
    check (seller_trial_days > 0),
  seller_trial_quota integer not null default 10
    check (seller_trial_quota > 0),
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

create table if not exists public.marketplace_legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null unique
    check (
      document_type in (
        'terms_of_service',
        'seller_agreement',
        'privacy_policy',
        'copyright_takedown',
        'refund_policy',
        'cookie_policy',
        'digital_product_license',
        'payment_payout_policy',
        'product_content_policy',
        'complaint_dispute_policy',
        'child_data_policy',
        'data_processing_agreement',
        'subscription_policy',
        'product_submission_terms'
      )
    ),
  title text not null,
  summary text,
  content_html text not null default '<p></p>',
  provider_type text not null default 'individual' check (provider_type in ('individual', 'company')),
  provider_name text,
  provider_registration_no text,
  provider_tax_id text,
  provider_address text,
  contact_email text,
  provider_phone text,
  version text not null default '1.0',
  status text not null default 'draft' check (status in ('draft', 'published')),
  effective_at timestamptz,
  published_at timestamptz,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.marketplace_legal_documents (
  document_type,
  title,
  summary,
  content_html,
  status,
  version
)
values (
  'product_submission_terms',
  'เงื่อนไขการเผยแพร่สินค้า',
  'หลักเกณฑ์ด้านสิทธิ ความถูกต้องของข้อมูล และการตรวจสอบร่วมกันก่อนเผยแพร่สินค้า',
  '<ul><li>ผู้ขายมีสิทธิหรือได้รับอนุญาตให้เผยแพร่และจำหน่ายข้อความ รูปภาพ วิดีโอ เสียง ฟอนต์ แบบฝึกหัด และไฟล์ที่ใช้ในสินค้า</li><li>เนื้อหาสินค้าเป็นไปตามหลักเกณฑ์ด้านลิขสิทธิ์ เครื่องหมายการค้า สิทธิส่วนบุคคล และการคุ้มครองข้อมูลเด็ก นักเรียน หรือบุคคลอื่น</li><li>รายละเอียด ราคา เงื่อนไขการใช้งาน และสิ่งที่ผู้ซื้อจะได้รับแสดงไว้อย่างถูกต้องและครบถ้วน</li><li>หากมีข้อสงสัยหรือข้อร้องเรียน แพลตฟอร์มและผู้ขายจะร่วมกันตรวจสอบข้อมูลและดำเนินการตามนโยบายที่เกี่ยวข้อง</li></ul>',
  'draft',
  '1.0'
)
on conflict (document_type) do nothing;

create index if not exists marketplace_legal_documents_status_idx
  on public.marketplace_legal_documents (status, document_type);

create table if not exists public.marketplace_provider_settings (
  id text primary key default 'default' check (id = 'default'),
  provider_type text not null default 'individual' check (provider_type in ('individual', 'company')),
  first_name text,
  last_name text,
  company_name text,
  company_registration_no text,
  tax_id text,
  address text,
  contact_email text,
  contact_phone text,
  platform_name_th text,
  platform_name_en text,
  brand_name text,
  website_url text,
  support_email text,
  support_phone text,
  finance_email text,
  privacy_email text,
  line_oa_id text,
  business_hours text,
  complaint_url text,
  vat_registered boolean not null default false,
  vat_rate numeric(5,2) not null default 7,
  office_type text not null default 'head_office' check (office_type in ('head_office', 'branch')),
  branch_number text,
  document_issuer_name text,
  document_tax_address text,
  authorized_signatory_name text,
  signature_url text,
  seal_url text,
  receipt_prefix text,
  tax_invoice_prefix text,
  logo_url text,
  transparent_logo_url text,
  favicon_url text,
  og_image_url text,
  primary_color text default '#1565C0',
  footer_text text,
  copyright_text text,
  timezone text not null default 'Asia/Bangkok',
  currency text not null default 'THB',
  default_language text not null default 'th',
  service_country text not null default 'TH',
  production_url text,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.marketplace_provider_settings (id)
values ('default')
on conflict (id) do nothing;

create or replace function public.sync_marketplace_provider_to_legal_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.marketplace_legal_documents
  set
    provider_type = new.provider_type,
    provider_name = case
      when new.provider_type = 'company' then nullif(trim(new.company_name), '')
      else nullif(trim(concat_ws(' ', new.first_name, new.last_name)), '')
    end,
    provider_registration_no = case
      when new.provider_type = 'company' then nullif(trim(new.company_registration_no), '')
      else null
    end,
    provider_tax_id = nullif(trim(new.tax_id), ''),
    provider_address = nullif(trim(new.address), ''),
    contact_email = nullif(trim(new.contact_email), ''),
    provider_phone = nullif(trim(new.contact_phone), ''),
    updated_at = now()
  where id is not null;
  return new;
end;
$$;

drop trigger if exists sync_marketplace_provider_to_legal_documents_trigger
  on public.marketplace_provider_settings;

create trigger sync_marketplace_provider_to_legal_documents_trigger
after insert or update on public.marketplace_provider_settings
for each row execute function public.sync_marketplace_provider_to_legal_documents();

insert into public.marketplace_legal_documents (
  document_type,
  title,
  summary,
  content_html
)
values
  (
    'terms_of_service',
    'ข้อกำหนดการใช้บริการ E-KRU Marketplace',
    'ข้อกำหนดสำหรับผู้ใช้งาน ผู้ซื้อ และผู้เยี่ยมชม Marketplace',
    '<h2>1. ขอบเขตการให้บริการ</h2><p>กรุณาระบุขอบเขต สิทธิ และหน้าที่ของผู้ใช้งาน E-KRU Marketplace</p><h2>2. บัญชีผู้ใช้</h2><p>กรุณาระบุเงื่อนไขการสมัคร การรักษาความปลอดภัย และการระงับบัญชี</p><h2>3. การซื้อสินค้า</h2><p>กรุณาระบุเงื่อนไขการสั่งซื้อ การชำระเงิน และสิทธิการใช้งาน</p>'
  ),
  (
    'seller_agreement',
    'ข้อตกลงการเป็นผู้ขาย E-KRU Marketplace',
    'หน้าที่ มาตรฐาน ค่าธรรมเนียม และรอบจ่ายเงินสำหรับผู้ขาย',
    '<h2>1. คุณสมบัติผู้ขาย</h2><p>กรุณาระบุคุณสมบัติและเอกสารที่ใช้ยืนยันตัวตน</p><h2>2. การลงสินค้า</h2><p>กรุณาระบุมาตรฐานสินค้า สิทธิในทรัพย์สินทางปัญญา และขั้นตอนอนุมัติ</p><h2>3. ค่าธรรมเนียมและการจ่ายเงิน</h2><p>กรุณาระบุค่าคอมมิชชัน ค่าธรรมเนียมช่องทางชำระเงิน และรอบโอนเงิน</p>'
  ),
  (
    'privacy_policy',
    'นโยบายความเป็นส่วนตัว (PDPA)',
    'การเก็บ ใช้ เปิดเผย และคุ้มครองข้อมูลส่วนบุคคล',
    '<h2>1. ผู้ควบคุมข้อมูลส่วนบุคคล</h2><p>กรุณาระบุชื่อบุคคลผู้ให้บริการและช่องทางติดต่อ</p><h2>2. ข้อมูลที่เก็บรวบรวม</h2><p>กรุณาระบุประเภทข้อมูล วัตถุประสงค์ และฐานกฎหมาย</p><h2>3. สิทธิของเจ้าของข้อมูล</h2><p>กรุณาระบุวิธีขอเข้าถึง แก้ไข ลบ คัดค้าน หรือถอนความยินยอม</p>'
  ),
  (
    'copyright_takedown',
    'นโยบายลิขสิทธิ์และการนำเนื้อหาออก',
    'กระบวนการแจ้งละเมิดลิขสิทธิ์ ตรวจสอบ และนำเนื้อหาออก',
    '<h2>1. การเคารพลิขสิทธิ์</h2><p>ผู้ขายต้องมีสิทธิในเนื้อหาและไฟล์ที่นำมาจำหน่าย</p><h2>2. การแจ้งละเมิด</h2><p>กรุณาระบุข้อมูลและหลักฐานที่ผู้ร้องต้องส่ง</p><h2>3. การตรวจสอบและนำออก</h2><p>กรุณาระบุกรอบเวลา การระงับสินค้า และสิทธิชี้แจงของผู้ขาย</p>'
  ),
  (
    'refund_policy',
    'นโยบายการคืนเงิน',
    'เงื่อนไขและขั้นตอนขอคืนเงินสำหรับสินค้าดิจิทัลและ License',
    '<h2>1. สินค้าที่ขอคืนเงินได้</h2><p>กรุณาระบุกรณีไฟล์เสีย สื่อไม่ตรงรายละเอียด หรือไม่สามารถใช้งานได้</p><h2>2. ระยะเวลายื่นคำขอ</h2><p>กรุณาระบุจำนวนวันและหลักฐานที่ต้องใช้</p><h2>3. วิธีคืนเงิน</h2><p>กรุณาระบุระยะเวลาดำเนินการและช่องทางคืนเงิน</p>'
  ),
  (
    'cookie_policy',
    'นโยบายคุกกี้ E-KRU Marketplace',
    'อธิบายการใช้คุกกี้และเทคโนโลยีจัดเก็บข้อมูลบนอุปกรณ์ของผู้ใช้',
    '<h2>1. คุกกี้ที่จำเป็น</h2><p>ระบบใช้คุกกี้สำหรับการเข้าสู่ระบบ ความปลอดภัย การตั้งค่าหน้าจอ และการจดจำตัวเลือกคุกกี้</p><h2>2. การจัดเก็บข้อมูลบนอุปกรณ์</h2><p>ระบบอาจจัดเก็บตะกร้าสินค้า การปิดประกาศ และตัวระบุการเข้าชมไว้บนอุปกรณ์เพื่อให้บริการและปรับปรุงประสบการณ์ใช้งาน</p><h2>3. การจัดการตัวเลือก</h2><p>ผู้ใช้สามารถเลือกเฉพาะคุกกี้ที่จำเป็นหรือยอมรับทั้งหมด และกลับมาเปลี่ยนตัวเลือกได้จากส่วนท้ายของเว็บไซต์</p>'
  ),
  (
    'digital_product_license',
    'ใบอนุญาตใช้สินค้าดิจิทัล',
    'กำหนดสิทธิที่ผู้ซื้อได้รับ ขอบเขตผู้ใช้ การทำสำเนา และข้อห้ามในการแจกจ่ายต่อ',
    '<h2>1. สิทธิที่ได้รับ</h2><p>กรุณาระบุสิทธิสำหรับบุคคล ห้องเรียน โรงเรียน หรือองค์กรให้ชัดเจน</p><h2>2. สิ่งที่อนุญาต</h2><p>กรุณาระบุการพิมพ์ การแก้ไข การนำไปใช้สอน และจำนวนผู้ใช้งาน</p><h2>3. ข้อห้าม</h2><p>กรุณาระบุข้อห้ามเรื่องการขายต่อ แจกจ่าย อัปโหลดสาธารณะ และส่งต่อบัญชี</p>'
  ),
  (
    'payment_payout_policy',
    'นโยบายการชำระเงิน ค่าธรรมเนียม และการโอนให้ผู้ขาย',
    'อธิบายช่องทางชำระเงิน ค่าธรรมเนียม ระยะพักยอด รายรับสุทธิ และรอบโอนเงิน',
    '<h2>1. การรับชำระเงิน</h2><p>กรุณาระบุช่องทาง สถานะ และเวลายืนยันยอด</p><h2>2. ค่าธรรมเนียม</h2><p>กรุณาระบุค่าคอมมิชชัน ค่าธรรมเนียมผู้ให้บริการ และตัวอย่างรายรับสุทธิ</p><h2>3. การโอนเงิน</h2><p>กรุณาระบุระยะพักยอด ยอดขั้นต่ำ รอบโอน ภาษี และการปรับยอดจากการคืนเงินหรือ Chargeback</p>'
  ),
  (
    'product_content_policy',
    'นโยบายสินค้าและเนื้อหา',
    'มาตรฐานสินค้าที่อนุญาต เนื้อหาต้องห้าม ข้อมูลที่ต้องแสดง และขั้นตอนตรวจสอบ',
    '<h2>1. สินค้าที่อนุญาต</h2><p>กรุณาระบุประเภท คุณภาพ และข้อมูลขั้นต่ำของสินค้า</p><h2>2. เนื้อหาต้องห้าม</h2><p>กรุณาระบุเนื้อหาผิดกฎหมาย อันตราย ละเมิดสิทธิ ทำให้เข้าใจผิด หรือเปิดเผยข้อมูลส่วนบุคคล</p><h2>3. การตรวจสอบ</h2><p>กรุณาระบุขั้นตอนอนุมัติ การแก้ไข การซ่อน และการอุทธรณ์</p>'
  ),
  (
    'complaint_dispute_policy',
    'นโยบายข้อร้องเรียนและข้อพิพาท',
    'ช่องทาง หลักฐาน ระยะเวลาดำเนินการ และผลของข้อร้องเรียน การทุจริต และ Chargeback',
    '<h2>1. การแจ้งปัญหา</h2><p>กรุณาระบุช่องทาง ระยะเวลา และข้อมูลที่ผู้ร้องต้องส่ง</p><h2>2. การตรวจสอบ</h2><p>กรุณาระบุขั้นตอนขอหลักฐาน การพักยอด และกรอบเวลาตอบกลับ</p><h2>3. ผลการพิจารณาและอุทธรณ์</h2><p>กรุณาระบุวิธีคืนเงิน ปรับยอด จำกัดบัญชี และช่องทางอุทธรณ์</p>'
  ),
  (
    'child_data_policy',
    'นโยบายข้อมูลเด็กและนักเรียน',
    'หลักเกณฑ์การเก็บ ใช้ เปิดเผย และปกป้องข้อมูลเด็ก นักเรียน และผู้ปกครอง',
    '<h2>1. ข้อมูลที่เกี่ยวข้อง</h2><p>กรุณาระบุข้อมูลนักเรียน ผลการเรียน ภาพ เสียง ห้องเรียน และข้อมูลผู้ปกครอง</p><h2>2. ฐานกฎหมายและความยินยอม</h2><p>กรุณาระบุบทบาทของโรงเรียน ครู ผู้ปกครอง และผู้ควบคุมข้อมูล</p><h2>3. ความปลอดภัยและสิทธิ</h2><p>กรุณาระบุการจำกัดสิทธิ ระยะเวลาเก็บ การลบ และช่องทางใช้สิทธิ</p>'
  ),
  (
    'data_processing_agreement',
    'ข้อตกลงการประมวลผลข้อมูล (DPA)',
    'หน้าที่ของผู้ควบคุมและผู้ประมวลผลข้อมูลสำหรับโรงเรียน องค์กร และผู้ให้บริการภายนอก',
    '<h2>1. บทบาทและคำสั่ง</h2><p>กรุณาระบุคู่สัญญา ขอบเขต วัตถุประสงค์ และระยะเวลาประมวลผล</p><h2>2. มาตรการรักษาความมั่นคงปลอดภัย</h2><p>กรุณาระบุการควบคุมสิทธิ การเข้ารหัส สำรองข้อมูล และการแจ้งเหตุละเมิด</p><h2>3. ผู้ประมวลผลช่วงต่อและการคืนข้อมูล</h2><p>กรุณาระบุรายชื่อ/ประเภทผู้ให้บริการ การโอนข้อมูล และวิธีคืนหรือลบข้อมูลเมื่อสิ้นสุดบริการ</p>'
  ),
  (
    'subscription_policy',
    'นโยบายแพ็กเกจ การต่ออายุ และการยกเลิก',
    'เงื่อนไขการซื้อฟีเจอร์แบบซื้อขาด แบบโควต้า และแพ็กเกจที่มีรอบเวลา',
    '<h2>1. รูปแบบการซื้อ</h2><p>กรุณาแยกซื้อขาด แพ็กเกจตามระยะเวลา และบริการที่ตัดโควต้า</p><h2>2. การเริ่มใช้งานและต่ออายุ</h2><p>กรุณาระบุวันเริ่มใช้ การต่ออายุอัตโนมัติ การเปลี่ยนราคา และโควต้าคงเหลือ</p><h2>3. การยกเลิกและคืนเงิน</h2><p>กรุณาระบุผลเมื่อยกเลิก การหมดอายุ การใช้โควต้า และกรณีขอคืนเงิน</p>'
  )
on conflict (document_type) do nothing;

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
  add column if not exists business_address text,
  add column if not exists wizard_step integer not null default 1,
  add column if not exists seller_agreement_accepted_at timestamptz,
  add column if not exists copyright_confirmed_at timestamptz,
  add column if not exists fee_agreement_accepted_at timestamptz,
  add column if not exists pdpa_accepted_at timestamptz,
  add column if not exists commission_rate_override numeric(5, 2),
  add column if not exists pending_profile_data jsonb,
  add column if not exists profile_review_status text,
  add column if not exists profile_submitted_at timestamptz,
  add column if not exists profile_rejection_reason text;

alter table public.marketplace_sellers
  drop constraint if exists marketplace_sellers_profile_review_status_check;
alter table public.marketplace_sellers
  add constraint marketplace_sellers_profile_review_status_check
  check (profile_review_status is null or profile_review_status in ('draft', 'pending', 'rejected'));

create index if not exists marketplace_sellers_profile_review_pending_idx
  on public.marketplace_sellers (profile_submitted_at desc)
  where profile_review_status = 'pending';

alter table public.marketplace_sellers
  drop constraint if exists marketplace_sellers_commission_rate_override_check;
alter table public.marketplace_sellers
  add constraint marketplace_sellers_commission_rate_override_check
  check (
    commission_rate_override is null
    or (commission_rate_override >= 0 and commission_rate_override <= 100)
  );

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

create table if not exists public.marketplace_feedback (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  reporter_username text not null,
  reporter_role text not null,
  school_id uuid,
  category text not null
    check (category in ('feature', 'improvement', 'bug', 'blocker', 'general')),
  title text not null,
  system_area text,
  current_behavior text,
  requested_change text,
  blocker_detail text,
  page_url text,
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'planned', 'resolved', 'closed')),
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_feedback_reporter_created_idx
  on public.marketplace_feedback (reporter_id, created_at desc);
create index if not exists marketplace_feedback_status_created_idx
  on public.marketplace_feedback (status, created_at desc);

create table if not exists public.marketplace_popup_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  image_url text,
  link_url text,
  button_label text,
  audience text not null default 'all'
    check (audience in ('all', 'authenticated', 'guests', 'roles')),
  role_targets text[] not null default '{}',
  priority integer not null default 0 check (priority between 0 and 999),
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists marketplace_popup_announcements_active_idx
  on public.marketplace_popup_announcements
    (is_active, priority desc, starts_at, ends_at);

create table if not exists public.marketplace_seller_documents (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  document_type text not null
    check (document_type in (
      'store_logo', 'store_cover', 'identity_card', 'bank_book',
      'company_certificate', 'vat_certificate', 'receipt_signature'
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
  price numeric(12, 2) not null default 0
    check (price = 0 or price >= 10),
  list_price numeric(12, 2) check (list_price is null or (list_price >= 0 and list_price >= price)),
  currency text not null default 'THB',
  cover_url text,
  file_url text,
  external_links jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(external_links) = 'array'
      and jsonb_array_length(external_links) <= 3
    ),
  purchase_benefits jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(purchase_benefits) = 'array'
      and jsonb_array_length(purchase_benefits) <= 8
    ),
  purchase_benefits_html text,
  status text not null default 'pending_review'
    check (status in ('draft', 'pending_review', 'published', 'rejected', 'archived')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  submission_acceptance_snapshot jsonb not null default '{}'::jsonb,
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
  add column if not exists submission_acceptance_snapshot jsonb not null default '{}'::jsonb;
alter table public.marketplace_products
  drop column if exists file_url_2;
alter table public.marketplace_products
  add column if not exists short_description text;
alter table public.marketplace_products
  add column if not exists title_en text;
alter table public.marketplace_products
  add column if not exists short_description_en text;
alter table public.marketplace_products
  add column if not exists description_en text;
alter table public.marketplace_products
  add column if not exists subject_label text;
alter table public.marketplace_products
  add column if not exists list_price numeric(12, 2);
alter table public.marketplace_products
  add column if not exists external_links jsonb not null default '[]'::jsonb;
alter table public.marketplace_products
  drop constraint if exists marketplace_products_external_links_check;
alter table public.marketplace_products
  add constraint marketplace_products_external_links_check
  check (
    jsonb_typeof(external_links) = 'array'
    and jsonb_array_length(external_links) <= 3
  );
alter table public.marketplace_products
  add column if not exists purchase_benefits jsonb not null default '[]'::jsonb;
alter table public.marketplace_products
  add column if not exists purchase_benefits_html text;
alter table public.marketplace_products
  drop constraint if exists marketplace_products_purchase_benefits_check;
alter table public.marketplace_products
  add constraint marketplace_products_purchase_benefits_check
  check (
    jsonb_typeof(purchase_benefits) = 'array'
    and jsonb_array_length(purchase_benefits) <= 8
  );
alter table public.marketplace_products
  drop constraint if exists marketplace_products_list_price_check;
alter table public.marketplace_products
  add constraint marketplace_products_list_price_check
  check (list_price is null or (list_price >= 0 and list_price >= price));
alter table public.marketplace_products
  add column if not exists curriculum_id uuid references public.marketplace_curricula(id);
alter table public.marketplace_products
  add column if not exists wizard_step integer not null default 1;
-- The wizard creates a draft product at step 1 (title only); category isn't
-- chosen until step 2, so it can no longer be required at insert time.
alter table public.marketplace_products
  alter column category drop not null;
alter table public.marketplace_products
  add column if not exists grants_feature_key text;
alter table public.marketplace_products
  add column if not exists grant_duration_days integer;
alter table public.subscription_plans
  add column if not exists plan_scope text not null default 'school'
    check (plan_scope in ('school', 'individual'));
alter table public.marketplace_products
  add column if not exists license_scope text not null default 'school'
    check (license_scope in ('individual', 'school', 'teacher'));
alter table public.marketplace_products
  add column if not exists license_seat_count integer not null default 1
    check (license_seat_count > 0);
alter table public.marketplace_products
  add column if not exists grants_feature_keys text[] not null default '{}';
alter table public.marketplace_products
  add column if not exists grants_plan_code text,
  add column if not exists license_max_teachers integer check (license_max_teachers >= 0),
  add column if not exists license_max_students integer check (license_max_students >= 0),
  add column if not exists license_max_school_admins integer check (license_max_school_admins >= 0),
  add column if not exists license_line_quota integer check (license_line_quota >= 0);

update public.marketplace_products
set grants_feature_keys = array[grants_feature_key]
where grants_feature_key is not null
  and cardinality(grants_feature_keys) = 0;

alter table public.marketplace_products
  drop constraint if exists marketplace_products_status_check;
alter table public.marketplace_products
  add constraint marketplace_products_status_check
  check (status in ('draft', 'pending_review', 'published', 'rejected', 'archived'));

alter table public.marketplace_products
  drop constraint if exists marketplace_products_resource_type_check;
alter table public.marketplace_products
  add constraint marketplace_products_resource_type_check
  check (resource_type in ('digital', 'physical', 'service', 'feature_unlock'));

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

create table if not exists public.marketplace_product_grade_levels (
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  grade_level_id uuid not null references public.marketplace_grade_levels(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (product_id, grade_level_id)
);
create index if not exists marketplace_product_grade_levels_grade_idx
  on public.marketplace_product_grade_levels (grade_level_id);

create table if not exists public.marketplace_product_tags (
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  tag_id uuid not null references public.marketplace_tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (product_id, tag_id)
);
create index if not exists marketplace_product_tags_tag_idx
  on public.marketplace_product_tags (tag_id);

create table if not exists public.marketplace_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  storage_bucket text not null default 'marketplace-product-covers',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size integer not null check (file_size > 0),
  position integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists marketplace_product_images_product_idx
  on public.marketplace_product_images (product_id, position);
create unique index if not exists marketplace_product_images_one_cover_idx
  on public.marketplace_product_images (product_id) where is_cover;

create table if not exists public.marketplace_product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  storage_bucket text not null default 'marketplace-product-files',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size integer not null check (file_size > 0),
  position integer not null default 0,
  is_preview boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists marketplace_product_files_product_idx
  on public.marketplace_product_files (product_id, position);

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
  list_unit_price numeric(12, 2)
    check (list_unit_price is null or (list_unit_price >= 0 and list_unit_price >= unit_price)),
  quantity integer not null default 1 check (quantity > 0)
);

alter table public.marketplace_order_items
  add column if not exists list_unit_price numeric(12, 2);
alter table public.marketplace_order_items
  drop constraint if exists marketplace_order_items_list_unit_price_check;
alter table public.marketplace_order_items
  add constraint marketplace_order_items_list_unit_price_check
  check (
    list_unit_price is null
    or (list_unit_price >= 0 and list_unit_price >= unit_price)
  );

-- Public engagement shown on the product detail page. Views count unique
-- visitors, reviews are restricted to one per verified buyer, and every
-- authorized file request records a download event.
create table if not exists public.marketplace_product_views (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  visitor_key text not null,
  viewer_id uuid,
  ip_address text,
  user_agent text,
  request_id text,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  unique (product_id, visitor_key)
);
create index if not exists marketplace_product_views_product_idx
  on public.marketplace_product_views (product_id);

create or replace function public.marketplace_product_engagement_counts(product_ids uuid[])
returns table (
  product_id uuid,
  views bigint,
  purchases bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    requested.product_id,
    (
      select count(*)
      from public.marketplace_product_views product_view
      where product_view.product_id = requested.product_id
    ) as views,
    (
      select coalesce(sum(order_item.quantity), 0)
      from public.marketplace_order_items order_item
      join public.marketplace_orders marketplace_order
        on marketplace_order.id = order_item.order_id
      where order_item.product_id = requested.product_id
        and marketplace_order.status in ('paid', 'completed')
    ) as purchases
  from unnest(product_ids) as requested(product_id);
$$;

create table if not exists public.marketplace_product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  buyer_id uuid not null,
  reviewer_name text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, buyer_id)
);
create index if not exists marketplace_product_reviews_product_idx
  on public.marketplace_product_reviews (product_id, updated_at desc);

create table if not exists public.marketplace_review_images (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.marketplace_product_reviews(id) on delete cascade,
  storage_bucket text not null default 'marketplace-review-images',
  storage_path text not null,
  mime_type text not null,
  file_size integer not null check (file_size > 0 and file_size <= 5242880),
  position smallint not null default 0 check (position between 0 and 2),
  created_at timestamptz not null default now(),
  unique (review_id, storage_path)
);
create index if not exists marketplace_review_images_review_idx
  on public.marketplace_review_images (review_id, position);

create table if not exists public.marketplace_review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique
    references public.marketplace_product_reviews(id) on delete cascade,
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  responder_id uuid not null,
  responder_name text not null,
  comment text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_review_replies_seller_idx
  on public.marketplace_review_replies (seller_id, updated_at desc);

create table if not exists public.marketplace_product_downloads (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  product_file_id uuid not null references public.marketplace_product_files(id) on delete cascade,
  order_item_id uuid not null references public.marketplace_order_items(id) on delete cascade,
  buyer_id uuid not null,
  ip_address text,
  user_agent text,
  request_id text,
  downloaded_at timestamptz not null default now()
);
create index if not exists marketplace_product_downloads_product_idx
  on public.marketplace_product_downloads (product_id, downloaded_at desc);
create index if not exists marketplace_product_downloads_buyer_idx
  on public.marketplace_product_downloads (buyer_id, downloaded_at desc);

create table if not exists public.marketplace_product_collections (
  user_id uuid not null,
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  collection_type text not null check (collection_type in ('favorite', 'bookmark')),
  created_at timestamptz not null default now(),
  primary key (user_id, product_id, collection_type)
);
create index if not exists marketplace_product_collections_user_idx
  on public.marketplace_product_collections (user_id, collection_type, created_at desc);
create index if not exists marketplace_product_collections_product_type_idx
  on public.marketplace_product_collections (product_id, collection_type);

-- Marketplace purchases of "feature_unlock" products grant a school a
-- time-limited entitlement here. This is separate from (additive to)
-- school_subscriptions.enabled_features, since that table has one expiry per
-- whole plan while each purchased feature key needs its own, independently
-- renewable expiry.
create table if not exists public.school_feature_purchases (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  feature_key text not null,
  expires_at timestamptz not null,
  source_order_id uuid references public.marketplace_orders(id) on delete set null,
  source_product_id uuid references public.marketplace_products(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, feature_key)
);
create index if not exists school_feature_purchases_school_idx
  on public.school_feature_purchases (school_id);

create table if not exists public.marketplace_school_licenses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  product_id uuid not null references public.marketplace_products(id) on delete restrict,
  order_id uuid not null references public.marketplace_orders(id) on delete restrict,
  order_item_id uuid not null unique references public.marketplace_order_items(id) on delete restrict,
  license_scope text not null check (license_scope in ('school', 'teacher')),
  feature_keys text[] not null default '{}',
  seat_count integer not null default 1 check (seat_count > 0),
  grants_plan_code text,
  max_teachers integer check (max_teachers >= 0),
  max_students integer check (max_students >= 0),
  max_school_admins integer check (max_school_admins >= 0),
  line_quota integer check (line_quota >= 0),
  duration_days integer check (duration_days > 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active'
    check (status in ('active', 'renewed', 'expired', 'disputed', 'revoked', 'refunded')),
  revoked_at timestamptz,
  revoke_reason text,
  renewed_from_license_id uuid references public.marketplace_school_licenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_school_licenses_school_idx
  on public.marketplace_school_licenses (school_id, expires_at desc);
create index if not exists marketplace_school_licenses_features_idx
  on public.marketplace_school_licenses using gin (feature_keys);

create table if not exists public.marketplace_user_licenses (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null,
  product_id uuid not null references public.marketplace_products(id) on delete restrict,
  order_id uuid not null references public.marketplace_orders(id) on delete restrict,
  order_item_id uuid not null unique references public.marketplace_order_items(id) on delete restrict,
  feature_keys text[] not null default '{}',
  grants_plan_code text,
  duration_days integer check (duration_days > 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'renewed', 'expired', 'disputed', 'revoked', 'refunded')),
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
  payment_session_id uuid,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_school_license_events (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.marketplace_school_licenses(id) on delete restrict,
  event_type text not null
    check (event_type in ('created', 'renewed', 'expired', 'revoked', 'refunded')),
  order_id uuid references public.marketplace_orders(id) on delete set null,
  payment_session_id uuid,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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

-- Each seller connects their own LINE Official Account credentials. Access tokens
-- are encrypted by the application before they reach this table.
create table if not exists public.marketplace_seller_line_settings (
  seller_id uuid primary key references public.marketplace_sellers(id) on delete cascade,
  channel_access_token_encrypted text,
  line_user_id text,
  line_display_name text,
  line_linked_at timestamptz,
  is_enabled boolean not null default false,
  notify_payment_received boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_seller_line_link_tokens (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null unique references public.marketplace_sellers(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
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
  payout_bank_code text,
  payout_bank_name text,
  payout_account_number text,
  payout_account_name text,
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

create table if not exists public.marketplace_storage_settings (
  id text primary key default 'default' check (id = 'default'),
  capacity_bytes bigint not null default 1073741824 check (capacity_bytes > 0),
  warning_percent integer not null default 80 check (warning_percent between 1 and 99),
  critical_percent integer not null default 90 check (critical_percent between 2 and 100),
  updated_at timestamptz not null default now(),
  check (critical_percent > warning_percent)
);

insert into public.marketplace_storage_settings (id)
values ('default')
on conflict (id) do nothing;

create or replace function public.marketplace_storage_usage_summary()
returns table (
  bucket_id text,
  object_count bigint,
  total_bytes bigint,
  largest_object_bytes bigint,
  last_uploaded_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, public, storage
as $$
  select
    objects.bucket_id,
    count(*)::bigint as object_count,
    coalesce(sum(coalesce((objects.metadata ->> 'size')::bigint, 0)), 0)::bigint as total_bytes,
    coalesce(max(coalesce((objects.metadata ->> 'size')::bigint, 0)), 0)::bigint
      as largest_object_bytes,
    max(objects.created_at) as last_uploaded_at
  from storage.objects as objects
  group by objects.bucket_id
  order by total_bytes desc;
$$;

revoke all on function public.marketplace_storage_usage_summary() from public;
revoke all on function public.marketplace_storage_usage_summary() from anon;
revoke all on function public.marketplace_storage_usage_summary() from authenticated;
grant execute on function public.marketplace_storage_usage_summary() to service_role;

insert into public.marketplace_finance_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.marketplace_finance_settings
  add column if not exists stripe_enabled boolean not null default false,
  add column if not exists payout_bank_code text,
  add column if not exists payout_bank_name text,
  add column if not exists payout_account_number text,
  add column if not exists payout_account_name text;

-- Referral / affiliate rewards. The feature is opt-in at platform level and
-- defaults to disabled. Attribution terms are snapshotted on the order so
-- disabling the feature only stops new referrals, not rewards already promised.
create table if not exists public.marketplace_referral_settings (
  id text primary key default 'default' check (id = 'default'),
  is_enabled boolean not null default false,
  reward_rate numeric(5, 2) not null default 20
    check (reward_rate >= 0 and reward_rate <= 100),
  attribution_days integer not null default 30
    check (attribution_days >= 1 and attribution_days <= 365),
  hold_days integer not null default 14
    check (hold_days >= 0 and hold_days <= 180),
  minimum_payout numeric(12, 2) not null default 500
    check (minimum_payout >= 0),
  max_reward_per_order numeric(12, 2) not null default 300
    check (max_reward_per_order >= 0),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.marketplace_referral_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.marketplace_referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  code text not null unique check (code ~ '^[A-Z0-9]{8,20}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_referral_clicks (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null
    references public.marketplace_referral_codes(id) on delete cascade,
  landing_path text not null default '/',
  created_at timestamptz not null default now()
);

alter table public.marketplace_orders
  add column if not exists referral_code_id uuid
    references public.marketplace_referral_codes(id) on delete set null,
  add column if not exists referrer_id uuid,
  add column if not exists referral_reward_rate numeric(5, 2)
    check (referral_reward_rate is null or (referral_reward_rate >= 0 and referral_reward_rate <= 100)),
  add column if not exists referral_hold_days integer
    check (referral_hold_days is null or (referral_hold_days >= 0 and referral_hold_days <= 180)),
  add column if not exists referral_reward_cap numeric(12, 2)
    check (referral_reward_cap is null or referral_reward_cap >= 0);

create table if not exists public.marketplace_referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null
    references public.marketplace_referral_codes(id) on delete restrict,
  order_id uuid not null unique references public.marketplace_orders(id) on delete restrict,
  referrer_id uuid not null,
  referred_buyer_id uuid not null,
  order_amount numeric(12, 2) not null check (order_amount >= 0),
  platform_fee numeric(12, 2) not null check (platform_fee >= 0),
  reward_rate numeric(5, 2) not null check (reward_rate >= 0 and reward_rate <= 100),
  reward_amount numeric(12, 2) not null check (reward_amount > 0),
  currency text not null default 'THB',
  status text not null default 'pending'
    check (status in ('pending', 'available', 'paid', 'cancelled')),
  available_at timestamptz not null,
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_referral_rewards_referrer_status_idx
  on public.marketplace_referral_rewards (referrer_id, status, available_at);
create index if not exists marketplace_referral_clicks_code_created_idx
  on public.marketplace_referral_clicks (referral_code_id, created_at desc);

create table if not exists public.marketplace_payment_sessions (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'THB',
  payment_method text not null default 'promptpay'
    check (payment_method in ('promptpay', 'stripe', 'free')),
  status text not null default 'pending_payment'
    check (
      status in (
        'pending_payment', 'payment_review', 'verified', 'disputed', 'rejected', 'expired'
      )
    ),
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
alter table public.marketplace_orders
  add column if not exists license_school_id uuid references public.schools(id) on delete restrict;

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
      'paid', 'completed', 'disputed', 'cancelled', 'refunded'
    )
  );

create index if not exists marketplace_orders_payment_session_idx
  on public.marketplace_orders (payment_session_id);

create table if not exists public.marketplace_school_onboardings (
  id uuid primary key default gen_random_uuid(),
  payment_session_id uuid not null unique
    references public.marketplace_payment_sessions(id) on delete cascade,
  buyer_id uuid not null,
  email text not null,
  token_hash text not null unique,
  token_ciphertext text not null,
  email_sent_at timestamptz,
  expires_at timestamptz not null,
  completed_at timestamptz,
  school_id uuid references public.schools(id) on delete restrict,
  child_data_accepted boolean not null default false,
  dpa_accepted boolean not null default false,
  legal_documents_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.marketplace_school_onboardings
  add column if not exists child_data_accepted boolean not null default false,
  add column if not exists dpa_accepted boolean not null default false,
  add column if not exists legal_documents_snapshot jsonb not null default '[]'::jsonb;
create index if not exists marketplace_school_onboardings_buyer_idx
  on public.marketplace_school_onboardings (buyer_id, created_at desc);
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
    check (
      entry_type in (
        'sale', 'commission', 'gateway_fee', 'refund', 'adjustment',
        'chargeback', 'chargeback_reversal'
      )
    ),
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
  check (
    entry_type in (
      'sale', 'commission', 'gateway_fee', 'refund', 'adjustment',
      'chargeback', 'chargeback_reversal'
    )
  );

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
  ),
  (
    'marketplace-product-covers',
    'marketplace-product-covers',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'marketplace-product-files',
    'marketplace-product-files',
    false,
    52428800,
    array[
      'application/pdf',
      'application/zip',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]
  ),
  (
    'marketplace-review-images',
    'marketplace-review-images',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'marketplace-announcement-assets',
    'marketplace-announcement-assets',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
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
alter table if exists public.notifications
  drop constraint if exists notifications_user_id_fkey;
alter table if exists public.notifications
  add column if not exists source_id uuid;
create unique index if not exists notifications_invitation_source_key
  on public.notifications (user_id, type, source_id)
  where source_id is not null and type = 'marketplace_school_invitation';
alter table public.marketplace_email_verifications enable row level security;
alter table public.marketplace_sellers enable row level security;
alter table public.marketplace_seller_documents enable row level security;
alter table public.marketplace_products enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_order_items enable row level security;
alter table public.marketplace_seller_line_settings enable row level security;
alter table public.marketplace_seller_line_link_tokens enable row level security;
alter table public.marketplace_seller_line_deliveries enable row level security;
alter table public.marketplace_finance_settings enable row level security;
alter table public.marketplace_storage_settings enable row level security;
alter table public.marketplace_referral_settings enable row level security;
alter table public.marketplace_referral_codes enable row level security;
alter table public.marketplace_referral_clicks enable row level security;
alter table public.marketplace_referral_rewards enable row level security;
alter table public.marketplace_payment_sessions enable row level security;
alter table public.marketplace_seller_payout_accounts enable row level security;
alter table public.marketplace_payouts enable row level security;
alter table public.marketplace_ledger_entries enable row level security;
alter table public.marketplace_stripe_events enable row level security;
alter table public.marketplace_grade_levels enable row level security;
alter table public.marketplace_curricula enable row level security;
alter table public.marketplace_tags enable row level security;
alter table public.marketplace_legal_documents enable row level security;
alter table public.marketplace_provider_settings enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketplace-platform-assets',
  'marketplace-platform-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
alter table public.marketplace_product_grade_levels enable row level security;
alter table public.marketplace_product_tags enable row level security;
alter table public.marketplace_product_images enable row level security;
alter table public.marketplace_product_files enable row level security;
alter table public.marketplace_product_views enable row level security;
alter table public.marketplace_product_reviews enable row level security;
alter table public.marketplace_review_images enable row level security;
alter table public.marketplace_review_replies enable row level security;
alter table public.marketplace_product_downloads enable row level security;
alter table public.marketplace_popup_announcements enable row level security;
alter table public.marketplace_product_collections enable row level security;
alter table public.marketplace_school_licenses enable row level security;
alter table public.marketplace_school_onboardings enable row level security;
alter table public.marketplace_user_licenses enable row level security;
alter table public.marketplace_user_license_events enable row level security;
alter table public.marketplace_teacher_license_assignments enable row level security;
alter table public.school_feature_purchases enable row level security;

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
  negotiated_price numeric(12,2) not null check (negotiated_price >= 10),
  terms_snapshot text not null,
  expires_at timestamptz not null,
  status text not null default 'draft',
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
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
  child_data_accepted boolean not null default false,
  dpa_accepted boolean not null default false,
  subscription_accepted boolean not null default false,
  legal_documents_snapshot jsonb not null default '[]'::jsonb,
  signed_ip inet,
  signed_user_agent text,
  signed_at timestamptz not null default now()
);
alter table public.marketplace_contract_signatures
  add column if not exists child_data_accepted boolean not null default false,
  add column if not exists dpa_accepted boolean not null default false,
  add column if not exists subscription_accepted boolean not null default false,
  add column if not exists legal_documents_snapshot jsonb not null default '[]'::jsonb;
alter table public.marketplace_orders
  add column if not exists sales_deal_id uuid
    references public.marketplace_sales_deals(id) on delete set null;
create unique index if not exists marketplace_orders_sales_deal_key
  on public.marketplace_orders (sales_deal_id)
  where sales_deal_id is not null;
alter table public.marketplace_sales_deals enable row level security;
alter table public.marketplace_contract_signatures enable row level security;

-- Application APIs use the server-only service role. No anonymous table writes
-- are allowed; public product reads are intentionally exposed through the API.

create table if not exists public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_username text,
  actor_role text,
  category text not null,
  action text not null,
  target_type text,
  target_id text,
  result text not null check (result in ('success', 'failure', 'denied')),
  ip_address text,
  user_agent text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists security_audit_logs_created_idx
  on public.security_audit_logs (created_at desc);
create index if not exists security_audit_logs_actor_idx
  on public.security_audit_logs (actor_id, created_at desc);
create index if not exists security_audit_logs_category_idx
  on public.security_audit_logs (category, created_at desc);
create index if not exists security_audit_logs_action_idx
  on public.security_audit_logs (action, created_at desc);
create index if not exists security_audit_logs_result_idx
  on public.security_audit_logs (result, created_at desc);
alter table public.security_audit_logs enable row level security;
revoke all on table public.security_audit_logs from anon, authenticated;

create or replace function public.prevent_security_audit_log_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'security audit logs are append-only';
end;
$$;
drop trigger if exists security_audit_logs_append_only on public.security_audit_logs;
create trigger security_audit_logs_append_only
before update or delete on public.security_audit_logs
for each row execute function public.prevent_security_audit_log_mutation();

-- Immutable checkout and usage evidence used for card-dispute responses.
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

alter table public.marketplace_order_evidence enable row level security;
alter table public.marketplace_customer_communications enable row level security;
alter table public.marketplace_entitlement_usage_events enable row level security;
alter table public.marketplace_payment_disputes enable row level security;

create table if not exists public.marketplace_product_review_submissions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  submission_number integer not null check (submission_number > 0),
  product_title_snapshot text not null,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'published', 'rejected')),
  submitted_at timestamptz not null,
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  acceptance_version text,
  seller_attestations jsonb not null default '{}'::jsonb,
  legal_document_versions jsonb not null default '{}'::jsonb,
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, submission_number)
);
create index if not exists marketplace_product_review_submissions_product_idx
  on public.marketplace_product_review_submissions (product_id, submission_number desc);

alter table public.marketplace_product_review_submissions
  add column if not exists acceptance_version text,
  add column if not exists seller_attestations jsonb not null default '{}'::jsonb,
  add column if not exists legal_document_versions jsonb not null default '{}'::jsonb,
  add column if not exists accepted_by uuid,
  add column if not exists accepted_at timestamptz;

alter table public.marketplace_product_review_submissions enable row level security;
revoke all on table public.marketplace_product_review_submissions from anon, authenticated;

create or replace function public.capture_marketplace_product_review_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_submission_number integer;
  submitting_user_id uuid;
begin
  if new.submitted_at is distinct from old.submitted_at and new.submitted_at is not null then
    perform pg_advisory_xact_lock(hashtextextended(new.id::text, 0));

    select owner_id into submitting_user_id
      from public.marketplace_sellers
      where id = new.seller_id;

    select coalesce(max(submission_number), 0) + 1
      into next_submission_number
      from public.marketplace_product_review_submissions
      where product_id = new.id;

    insert into public.marketplace_product_review_submissions (
      product_id,
      submission_number,
      product_title_snapshot,
      status,
      submitted_at,
      reviewed_at,
      reviewed_by,
      rejection_reason,
      acceptance_version,
      seller_attestations,
      legal_document_versions,
      accepted_by,
      accepted_at,
      updated_at
    )
    values (
      new.id,
      next_submission_number,
      new.title,
      case
        when new.status in ('pending_review', 'published', 'rejected') then new.status
        else 'pending_review'
      end,
      new.submitted_at,
      new.reviewed_at,
      new.reviewed_by,
      new.rejection_reason,
      nullif(new.submission_acceptance_snapshot ->> 'version', ''),
      coalesce(new.submission_acceptance_snapshot -> 'attestations', '{}'::jsonb),
      coalesce(new.submission_acceptance_snapshot -> 'legal_documents', '{}'::jsonb),
      submitting_user_id,
      new.submitted_at,
      now()
    );
  elsif (
    new.status is distinct from old.status
    or new.reviewed_at is distinct from old.reviewed_at
    or new.rejection_reason is distinct from old.rejection_reason
  ) and new.status in ('published', 'rejected') then
    update public.marketplace_product_review_submissions
    set
      status = new.status,
      reviewed_at = new.reviewed_at,
      reviewed_by = new.reviewed_by,
      rejection_reason = new.rejection_reason,
      updated_at = now()
    where id = (
      select id
      from public.marketplace_product_review_submissions
      where product_id = new.id
      order by submission_number desc
      limit 1
    );
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_products_capture_review_history
  on public.marketplace_products;
create trigger marketplace_products_capture_review_history
after update of submitted_at, status, reviewed_at, rejection_reason
on public.marketplace_products
for each row
execute function public.capture_marketplace_product_review_history();

insert into public.marketplace_product_review_submissions (
  product_id,
  submission_number,
  product_title_snapshot,
  status,
  submitted_at,
  reviewed_at,
  reviewed_by,
  rejection_reason,
  created_at,
  updated_at
)
select
  id,
  1,
  title,
  status,
  submitted_at,
  reviewed_at,
  reviewed_by,
  rejection_reason,
  submitted_at,
  coalesce(reviewed_at, submitted_at)
from public.marketplace_products
where submitted_at is not null
  and status in ('pending_review', 'published', 'rejected')
on conflict (product_id, submission_number) do nothing;
