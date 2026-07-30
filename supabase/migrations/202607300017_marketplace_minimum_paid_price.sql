-- Paid Marketplace products and negotiated deals must remain eligible for
-- Stripe's THB minimum charge after all discounts are applied.
alter table public.marketplace_products
  drop constraint if exists marketplace_products_minimum_paid_price_check;

alter table public.marketplace_products
  add constraint marketplace_products_minimum_paid_price_check
  check (price = 0 or price >= 10);

alter table public.marketplace_sales_deals
  drop constraint if exists marketplace_sales_deals_minimum_price_check;

alter table public.marketplace_sales_deals
  add constraint marketplace_sales_deals_minimum_price_check
  check (negotiated_price >= 10);
