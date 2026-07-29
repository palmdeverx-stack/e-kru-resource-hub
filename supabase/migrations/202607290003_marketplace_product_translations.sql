alter table public.marketplace_products
  add column if not exists title_en text;

alter table public.marketplace_products
  add column if not exists short_description_en text;

alter table public.marketplace_products
  add column if not exists description_en text;

