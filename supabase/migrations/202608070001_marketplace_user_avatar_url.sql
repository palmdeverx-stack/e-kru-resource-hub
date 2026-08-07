alter table public.marketplace_users
  add column if not exists avatar_url text;
