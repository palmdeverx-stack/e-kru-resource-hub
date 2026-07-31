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

alter table public.marketplace_legal_documents
  drop constraint if exists marketplace_legal_documents_provider_type_check;

alter table public.marketplace_legal_documents
  add constraint marketplace_legal_documents_provider_type_check
  check (provider_type in ('individual', 'company'));

alter table public.marketplace_legal_documents
  add column if not exists provider_registration_no text,
  add column if not exists provider_phone text;

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

alter table public.marketplace_provider_settings enable row level security;
