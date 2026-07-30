alter table public.marketplace_contract_signatures
  add column if not exists child_data_accepted boolean not null default false,
  add column if not exists dpa_accepted boolean not null default false,
  add column if not exists subscription_accepted boolean not null default false,
  add column if not exists legal_documents_snapshot jsonb not null default '[]'::jsonb;

alter table public.marketplace_school_onboardings
  add column if not exists child_data_accepted boolean not null default false,
  add column if not exists dpa_accepted boolean not null default false,
  add column if not exists legal_documents_snapshot jsonb not null default '[]'::jsonb;
