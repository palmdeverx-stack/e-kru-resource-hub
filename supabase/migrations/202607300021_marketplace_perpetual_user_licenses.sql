alter table public.marketplace_user_licenses
  alter column duration_days drop not null,
  alter column expires_at drop not null;
