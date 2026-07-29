alter table public.marketplace_line_settings
  add column if not exists allow_seller_notifications boolean not null default false;
