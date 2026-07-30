alter table public.marketplace_products
  add column if not exists purchase_benefits_html text;

comment on column public.marketplace_products.purchase_benefits_html is
  'Rich-text HTML describing what the buyer receives after purchase. Rendered through the restricted TipTap schema.';
