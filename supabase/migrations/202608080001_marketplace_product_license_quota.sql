alter table public.marketplace_products
  add column if not exists license_quota integer check (license_quota > 0);
