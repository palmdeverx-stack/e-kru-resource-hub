alter table public.marketplace_products
  drop constraint if exists marketplace_products_purchase_benefits_check;
alter table public.marketplace_products
  add constraint marketplace_products_purchase_benefits_check
  check (jsonb_typeof(purchase_benefits) = 'array' and jsonb_array_length(purchase_benefits) <= 10);
