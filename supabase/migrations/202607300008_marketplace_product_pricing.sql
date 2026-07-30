alter table public.marketplace_products
  add column if not exists list_price numeric(12, 2);

alter table public.marketplace_products
  drop constraint if exists marketplace_products_list_price_check;
alter table public.marketplace_products
  add constraint marketplace_products_list_price_check
  check (list_price is null or (list_price >= 0 and list_price >= price));

alter table public.marketplace_order_items
  add column if not exists list_unit_price numeric(12, 2);

alter table public.marketplace_order_items
  drop constraint if exists marketplace_order_items_list_unit_price_check;
alter table public.marketplace_order_items
  add constraint marketplace_order_items_list_unit_price_check
  check (
    list_unit_price is null
    or (list_unit_price >= 0 and list_unit_price >= unit_price)
  );

comment on column public.marketplace_products.list_price is
  'Original price shown before discount. The price column remains the actual selling price.';
comment on column public.marketplace_order_items.list_unit_price is
  'Original unit price snapshot at checkout for discount reporting.';
