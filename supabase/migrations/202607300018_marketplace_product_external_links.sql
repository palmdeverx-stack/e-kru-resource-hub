alter table public.marketplace_products
  add column if not exists external_links jsonb not null default '[]'::jsonb;

alter table public.marketplace_products
  drop constraint if exists marketplace_products_external_links_check;

alter table public.marketplace_products
  add constraint marketplace_products_external_links_check
  check (
    jsonb_typeof(external_links) = 'array'
    and jsonb_array_length(external_links) <= 3
  );

notify pgrst, 'reload schema';
