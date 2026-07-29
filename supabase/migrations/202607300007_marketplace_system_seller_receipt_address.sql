-- Business address used when the Super Admin's system store issues receipts.

alter table public.marketplace_sellers
  add column if not exists business_address text;

