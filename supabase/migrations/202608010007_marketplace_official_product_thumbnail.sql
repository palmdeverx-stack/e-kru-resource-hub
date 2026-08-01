alter table public.marketplace_provider_settings
  add column if not exists official_product_thumbnail_url text;

comment on column public.marketplace_provider_settings.official_product_thumbnail_url is
  'Fallback thumbnail shown for official-store products that do not have their own image.';
