alter table public.marketplace_provider_settings
  add column if not exists platform_name_th text,
  add column if not exists platform_name_en text,
  add column if not exists brand_name text,
  add column if not exists website_url text,
  add column if not exists support_email text,
  add column if not exists support_phone text,
  add column if not exists finance_email text,
  add column if not exists privacy_email text,
  add column if not exists line_oa_id text,
  add column if not exists business_hours text,
  add column if not exists complaint_url text,
  add column if not exists vat_registered boolean not null default false,
  add column if not exists vat_rate numeric(5,2) not null default 7,
  add column if not exists office_type text not null default 'head_office'
    check (office_type in ('head_office', 'branch')),
  add column if not exists branch_number text,
  add column if not exists document_issuer_name text,
  add column if not exists document_tax_address text,
  add column if not exists authorized_signatory_name text,
  add column if not exists signature_url text,
  add column if not exists seal_url text,
  add column if not exists receipt_prefix text,
  add column if not exists tax_invoice_prefix text,
  add column if not exists logo_url text,
  add column if not exists transparent_logo_url text,
  add column if not exists favicon_url text,
  add column if not exists og_image_url text,
  add column if not exists primary_color text default '#1565C0',
  add column if not exists footer_text text,
  add column if not exists copyright_text text,
  add column if not exists timezone text not null default 'Asia/Bangkok',
  add column if not exists currency text not null default 'THB',
  add column if not exists default_language text not null default 'th',
  add column if not exists service_country text not null default 'TH',
  add column if not exists production_url text;

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
