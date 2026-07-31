create or replace function public.marketplace_seller_account_stats(seller_ids uuid[])
returns table (
  seller_id uuid,
  product_count bigint,
  sold_count bigint,
  view_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    requested.seller_id,
    (
      select count(*)
      from public.marketplace_products product
      where product.seller_id = requested.seller_id
    ) as product_count,
    (
      select coalesce(sum(order_item.quantity), 0)
      from public.marketplace_order_items order_item
      join public.marketplace_orders marketplace_order
        on marketplace_order.id = order_item.order_id
      join public.marketplace_products product
        on product.id = order_item.product_id
      where product.seller_id = requested.seller_id
        and marketplace_order.status in ('paid', 'completed')
    ) as sold_count,
    (
      select count(*)
      from public.marketplace_product_views product_view
      join public.marketplace_products product
        on product.id = product_view.product_id
      where product.seller_id = requested.seller_id
    ) as view_count
  from unnest(seller_ids) as requested(seller_id);
$$;

comment on function public.marketplace_seller_account_stats(uuid[]) is
  'Aggregates product, paid unit sales, and unique-per-product view counts for admin seller accounts.';
