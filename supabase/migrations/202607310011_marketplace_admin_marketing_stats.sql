create or replace function public.marketplace_admin_marketing_stats(
  since_at timestamptz,
  until_at timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with
paid_orders as (
  select
    marketplace_order.id,
    marketplace_order.seller_id,
    marketplace_order.created_at,
    coalesce(marketplace_order.gross_amount, marketplace_order.total, 0) as gross_amount,
    coalesce(marketplace_order.platform_fee, 0) as platform_fee
  from public.marketplace_orders marketplace_order
  where marketplace_order.status in ('paid', 'completed')
    and marketplace_order.created_at >= since_at
    and marketplace_order.created_at < until_at
),
paid_items as (
  select
    order_item.product_id,
    order_item.title,
    order_item.quantity,
    order_item.unit_price,
    paid_order.seller_id,
    paid_order.created_at
  from public.marketplace_order_items order_item
  join paid_orders paid_order on paid_order.id = order_item.order_id
),
period_views as (
  select product_view.product_id, product_view.visitor_key, product_view.first_viewed_at
  from public.marketplace_product_views product_view
  where product_view.first_viewed_at >= since_at
    and product_view.first_viewed_at < until_at
),
daily as (
  select
    day::date as date,
    coalesce((select count(*) from paid_orders where created_at >= day and created_at < day + interval '1 day'), 0) as orders,
    coalesce((select sum(gross_amount) from paid_orders where created_at >= day and created_at < day + interval '1 day'), 0) as sales,
    coalesce((select count(*) from period_views where first_viewed_at >= day and first_viewed_at < day + interval '1 day'), 0) as product_views,
    coalesce((select count(*) from public.marketplace_users where created_at >= day and created_at < day + interval '1 day'), 0) as new_users
  from generate_series(
    date_trunc('day', since_at),
    date_trunc('day', until_at - interval '1 second'),
    interval '1 day'
  ) day
),
product_sales as (
  select
    paid_item.product_id,
    max(paid_item.title) as title,
    sum(paid_item.quantity) as units_sold,
    sum(paid_item.quantity * paid_item.unit_price) as revenue
  from paid_items paid_item
  group by paid_item.product_id
),
product_views as (
  select period_view.product_id, count(*) as views
  from period_views period_view
  group by period_view.product_id
),
top_products as (
  select
    coalesce(product_sale.product_id, product_view.product_id) as product_id,
    coalesce(product_sale.title, product.title, 'ไม่ระบุชื่อสินค้า') as title,
    coalesce(product_sale.units_sold, 0) as units_sold,
    coalesce(product_sale.revenue, 0) as revenue,
    coalesce(product_view.views, 0) as views
  from product_sales product_sale
  full outer join product_views product_view on product_view.product_id = product_sale.product_id
  left join public.marketplace_products product
    on product.id = coalesce(product_sale.product_id, product_view.product_id)
  order by coalesce(product_sale.revenue, 0) desc, coalesce(product_view.views, 0) desc
  limit 10
),
seller_order_stats as (
  select
    paid_order.seller_id,
    count(*) as orders,
    sum(paid_order.gross_amount) as revenue
  from paid_orders paid_order
  group by paid_order.seller_id
),
seller_item_stats as (
  select paid_item.seller_id, sum(paid_item.quantity) as units_sold
  from paid_items paid_item
  group by paid_item.seller_id
),
top_sellers as (
  select
    seller.id as seller_id,
    seller.display_name,
    seller_order_stat.orders,
    seller_order_stat.revenue,
    coalesce(seller_item_stat.units_sold, 0) as units_sold
  from seller_order_stats seller_order_stat
  join public.marketplace_sellers seller on seller.id = seller_order_stat.seller_id
  left join seller_item_stats seller_item_stat on seller_item_stat.seller_id = seller.id
  order by seller_order_stat.revenue desc, seller_order_stat.orders desc
  limit 10
)
select jsonb_build_object(
  'summary', jsonb_build_object(
    'orders', (select count(*) from paid_orders),
    'grossSales', coalesce((select sum(gross_amount) from paid_orders), 0),
    'platformRevenue', coalesce((select sum(platform_fee) from paid_orders), 0),
    'unitsSold', coalesce((select sum(quantity) from paid_items), 0),
    'productViews', (select count(*) from period_views),
    'productVisitors', (select count(distinct visitor_key) from period_views),
    'newUsers', (select count(*) from public.marketplace_users where created_at >= since_at and created_at < until_at),
    'newSellers', (select count(*) from public.marketplace_sellers where owner_role <> 'master_admin' and created_at >= since_at and created_at < until_at),
    'newProducts', (select count(*) from public.marketplace_products where created_at >= since_at and created_at < until_at)
  ),
  'daily', coalesce((select jsonb_agg(to_jsonb(daily) order by date) from daily), '[]'::jsonb),
  'topProducts', coalesce((select jsonb_agg(to_jsonb(top_products)) from top_products), '[]'::jsonb),
  'topSellers', coalesce((select jsonb_agg(to_jsonb(top_sellers)) from top_sellers), '[]'::jsonb)
);
$$;

revoke all on function public.marketplace_admin_marketing_stats(timestamptz, timestamptz) from public;
grant execute on function public.marketplace_admin_marketing_stats(timestamptz, timestamptz) to service_role;
