alter table public.marketplace_products
  add column if not exists purchase_benefits jsonb not null default '[]'::jsonb;

alter table public.marketplace_products
  drop constraint if exists marketplace_products_purchase_benefits_check;

alter table public.marketplace_products
  add constraint marketplace_products_purchase_benefits_check
  check (
    jsonb_typeof(purchase_benefits) = 'array'
    and jsonb_array_length(purchase_benefits) <= 8
  );

notify pgrst, 'reload schema';
