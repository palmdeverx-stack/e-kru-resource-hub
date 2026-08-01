create table if not exists public.marketplace_search_events (
  id uuid primary key default gen_random_uuid(),
  query_text text not null check (char_length(query_text) between 2 and 120),
  normalized_query text not null check (char_length(normalized_query) between 2 and 120),
  result_count integer not null default 0 check (result_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists marketplace_search_events_created_idx
  on public.marketplace_search_events (created_at desc);
create index if not exists marketplace_search_events_query_idx
  on public.marketplace_search_events (normalized_query, created_at desc);

create table if not exists public.marketplace_search_event_products (
  search_event_id uuid not null
    references public.marketplace_search_events(id) on delete cascade,
  product_id uuid not null
    references public.marketplace_products(id) on delete cascade,
  seller_id uuid not null
    references public.marketplace_sellers(id) on delete cascade,
  position integer not null check (position > 0),
  primary key (search_event_id, product_id)
);

create index if not exists marketplace_search_event_products_seller_idx
  on public.marketplace_search_event_products (seller_id, search_event_id);

alter table public.marketplace_search_events enable row level security;
alter table public.marketplace_search_event_products enable row level security;

create or replace function public.marketplace_seller_analytics(
  target_seller_id uuid,
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
seller_products as (
  select product.id, product.title, product.status
  from public.marketplace_products product
  where product.seller_id = target_seller_id
),
paid_orders as (
  select
    marketplace_order.id,
    coalesce(marketplace_order.paid_at, marketplace_order.created_at) as occurred_at,
    coalesce(marketplace_order.gross_amount, marketplace_order.total, 0) as gross_amount,
    coalesce(marketplace_order.seller_net, marketplace_order.total, 0) as seller_net
  from public.marketplace_orders marketplace_order
  where marketplace_order.seller_id = target_seller_id
    and marketplace_order.status in ('paid', 'completed')
    and coalesce(marketplace_order.paid_at, marketplace_order.created_at) >= since_at
    and coalesce(marketplace_order.paid_at, marketplace_order.created_at) < until_at
),
paid_items as (
  select
    order_item.order_id,
    order_item.product_id,
    order_item.quantity,
    order_item.quantity * order_item.unit_price as line_revenue,
    paid_order.occurred_at,
    case
      when paid_order.gross_amount > 0 then
        paid_order.seller_net *
        (order_item.quantity * order_item.unit_price) / paid_order.gross_amount
      else 0
    end as line_net_revenue
  from public.marketplace_order_items order_item
  join paid_orders paid_order on paid_order.id = order_item.order_id
),
period_views as (
  select product_view.product_id, product_view.visitor_key, product_view.last_viewed_at
  from public.marketplace_product_views product_view
  join seller_products product on product.id = product_view.product_id
  where product_view.last_viewed_at >= since_at
    and product_view.last_viewed_at < until_at
),
daily as (
  select
    (day at time zone 'Asia/Bangkok')::date as date,
    coalesce((select count(*) from paid_orders where occurred_at >= day and occurred_at < day + interval '1 day'), 0) as orders,
    coalesce((select sum(gross_amount) from paid_orders where occurred_at >= day and occurred_at < day + interval '1 day'), 0) as gross_sales,
    coalesce((select sum(seller_net) from paid_orders where occurred_at >= day and occurred_at < day + interval '1 day'), 0) as net_revenue,
    coalesce((select sum(quantity) from paid_items where occurred_at >= day and occurred_at < day + interval '1 day'), 0) as units_sold,
    coalesce((select count(*) from period_views where last_viewed_at >= day and last_viewed_at < day + interval '1 day'), 0) as product_views,
    coalesce((select count(distinct visitor_key) from period_views where last_viewed_at >= day and last_viewed_at < day + interval '1 day'), 0) as visitors
  from generate_series(
    date_trunc('day', since_at at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok',
    date_trunc('day', (until_at - interval '1 second') at time zone 'Asia/Bangkok')
      at time zone 'Asia/Bangkok',
    interval '1 day'
  ) day
),
product_sales as (
  select
    paid_item.product_id,
    count(distinct paid_item.order_id) as orders,
    sum(paid_item.quantity) as units_sold,
    sum(paid_item.line_revenue) as gross_sales,
    sum(paid_item.line_net_revenue) as net_revenue
  from paid_items paid_item
  group by paid_item.product_id
),
product_traffic as (
  select
    period_view.product_id,
    count(*) as product_views,
    count(distinct period_view.visitor_key) as visitors
  from period_views period_view
  group by period_view.product_id
),
product_stats as (
  select
    product.id as product_id,
    product.title,
    product.status,
    coalesce(product_traffic.product_views, 0) as product_views,
    coalesce(product_traffic.visitors, 0) as visitors,
    coalesce(product_sale.orders, 0) as orders,
    coalesce(product_sale.units_sold, 0) as units_sold,
    coalesce(product_sale.gross_sales, 0) as gross_sales,
    coalesce(product_sale.net_revenue, 0) as net_revenue
  from seller_products product
  left join product_sales product_sale on product_sale.product_id = product.id
  left join product_traffic on product_traffic.product_id = product.id
  order by
    coalesce(product_sale.gross_sales, 0) desc,
    coalesce(product_traffic.product_views, 0) desc,
    product.title
),
seller_search_events as (
  select
    search_event.id,
    search_event.query_text,
    search_event.normalized_query,
    search_event.created_at,
    search_product.product_id
  from public.marketplace_search_events search_event
  join public.marketplace_search_event_products search_product
    on search_product.search_event_id = search_event.id
  where search_product.seller_id = target_seller_id
    and search_event.created_at >= since_at
    and search_event.created_at < until_at
),
search_terms as (
  select
    normalized_query as query,
    max(query_text) as display_query,
    count(distinct id) as searches,
    count(*) as product_impressions,
    count(distinct product_id) as matched_products,
    max(created_at) as last_searched_at
  from seller_search_events
  group by normalized_query
  order by count(distinct id) desc, count(*) desc, max(created_at) desc
  limit 50
)
select jsonb_build_object(
  'summary', jsonb_build_object(
    'products', (select count(*) from seller_products),
    'publishedProducts', (select count(*) from seller_products where status = 'published'),
    'orders', (select count(*) from paid_orders),
    'grossSales', coalesce((select sum(gross_amount) from paid_orders), 0),
    'netRevenue', coalesce((select sum(seller_net) from paid_orders), 0),
    'unitsSold', coalesce((select sum(quantity) from paid_items), 0),
    'productViews', (select count(*) from period_views),
    'visitors', (select count(distinct visitor_key) from period_views)
  ),
  'daily', coalesce((select jsonb_agg(to_jsonb(daily) order by date) from daily), '[]'::jsonb),
  'products', coalesce((select jsonb_agg(to_jsonb(product_stats)) from product_stats), '[]'::jsonb),
  'searchSummary', jsonb_build_object(
    'searches', (select count(distinct id) from seller_search_events),
    'uniqueTerms', (select count(distinct normalized_query) from seller_search_events),
    'productImpressions', (select count(*) from seller_search_events)
  ),
  'searchTerms', coalesce((select jsonb_agg(to_jsonb(search_terms)) from search_terms), '[]'::jsonb)
);
$$;

revoke all on function public.marketplace_seller_analytics(uuid, timestamptz, timestamptz)
  from public;
grant execute on function public.marketplace_seller_analytics(uuid, timestamptz, timestamptz)
  to service_role;
