create or replace function public.marketplace_product_engagement_counts(product_ids uuid[])
returns table (
  product_id uuid,
  views bigint,
  purchases bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    requested.product_id,
    (
      select count(*)
      from public.marketplace_product_views product_view
      where product_view.product_id = requested.product_id
    ) as views,
    (
      select coalesce(sum(order_item.quantity), 0)
      from public.marketplace_order_items order_item
      join public.marketplace_orders marketplace_order
        on marketplace_order.id = order_item.order_id
      where order_item.product_id = requested.product_id
        and marketplace_order.status in ('paid', 'completed')
    ) as purchases
  from unnest(product_ids) as requested(product_id);
$$;
