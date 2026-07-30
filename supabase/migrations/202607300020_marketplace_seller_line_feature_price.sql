alter table public.marketplace_line_settings
  add column if not exists seller_notification_price numeric(12, 2) not null default 99
  check (seller_notification_price >= 10);
