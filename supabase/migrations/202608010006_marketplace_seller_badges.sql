create table if not exists public.marketplace_seller_badge_settings (
  badge_key text primary key check (
    badge_key in (
      'top_seller',
      'highly_rated',
      'best_seller',
      'rising_creator',
      'customer_favorite',
      'new_creator'
    )
  ),
  label_th text not null,
  label_en text not null,
  description_th text not null,
  description_en text not null,
  icon_key text not null,
  color text not null default '#1565F5',
  is_enabled boolean not null default true,
  evaluation_days integer not null default 90 check (evaluation_days between 1 and 3650),
  criteria jsonb not null default '{}'::jsonb,
  priority integer not null default 0,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.marketplace_seller_badge_settings (
  badge_key,
  label_th,
  label_en,
  description_th,
  description_en,
  icon_key,
  color,
  evaluation_days,
  criteria,
  priority
)
values
  (
    'top_seller', 'Top Seller', 'Top Seller',
    'ยอดขายและคะแนนรวมโดดเด่น', 'Outstanding sales and customer ratings',
    'trophy', '#D97706', 90,
    '{"min_orders":20,"min_gross_sales":10000,"min_average_rating":4.5,"min_review_count":5}'::jsonb,
    10
  ),
  (
    'highly_rated', 'Highly Rated', 'Highly Rated',
    'ได้รับคะแนนรีวิวเฉลี่ยระดับสูง', 'Maintains an excellent average review score',
    'star', '#EAB308', 365,
    '{"min_average_rating":4.9,"min_review_count":10}'::jsonb,
    20
  ),
  (
    'best_seller', 'Best Seller', 'Best Seller',
    'มีสินค้าติดอันดับขายดีของ Marketplace', 'Has products among the Marketplace best sellers',
    'fire', '#EA580C', 90,
    '{"top_product_limit":20,"min_best_seller_products":1,"min_units_sold":5}'::jsonb,
    30
  ),
  (
    'rising_creator', 'Rising Creator', 'Rising Creator',
    'ผู้ขายใหม่ที่มียอดขายเติบโตเร็ว', 'A newer seller with fast sales growth',
    'rocket', '#7C3AED', 30,
    '{"max_seller_age_days":365,"min_growth_percent":25,"min_orders":5}'::jsonb,
    40
  ),
  (
    'customer_favorite', 'Customer Favorite', 'Customer Favorite',
    'มีสัดส่วนผู้ซื้อกลับมาซื้อซ้ำสูง', 'A high share of customers return to buy again',
    'heart', '#E11D48', 180,
    '{"min_repeat_buyer_rate":30,"min_orders":10}'::jsonb,
    50
  ),
  (
    'new_creator', 'New Creator', 'New Creator',
    'ผู้ขายใหม่ที่เพิ่งเริ่มต้นบน Marketplace', 'A new seller getting started on the Marketplace',
    'sparkling', '#0891B2', 90,
    '{"max_seller_age_days":90}'::jsonb,
    60
  )
on conflict (badge_key) do nothing;

alter table public.marketplace_seller_badge_settings enable row level security;

create or replace function public.marketplace_public_seller_badges(seller_ids uuid[])
returns table (
  seller_id uuid,
  badge_key text,
  label_th text,
  label_en text,
  description_th text,
  description_en text,
  icon_key text,
  color text,
  priority integer
)
language sql
stable
security definer
set search_path = public
as $$
with eligible_sellers as (
  select seller.id, seller.created_at
  from public.marketplace_sellers seller
  where seller.id = any(seller_ids)
    and seller.status = 'active'
    and seller.owner_role not in ('master_admin', 'marketplace_admin')
),
enabled_badges as (
  select *
  from public.marketplace_seller_badge_settings setting
  where setting.is_enabled = true
)
select
  seller.id,
  badge.badge_key,
  badge.label_th,
  badge.label_en,
  badge.description_th,
  badge.description_en,
  badge.icon_key,
  badge.color,
  badge.priority
from eligible_sellers seller
cross join enabled_badges badge
where case badge.badge_key
  when 'top_seller' then
    (
      select count(*)
      from public.marketplace_orders marketplace_order
      where marketplace_order.seller_id = seller.id
        and marketplace_order.status in ('paid', 'completed')
        and coalesce(marketplace_order.paid_at, marketplace_order.created_at) >=
          now() - make_interval(days => badge.evaluation_days)
    ) >= coalesce((badge.criteria->>'min_orders')::numeric, 0)
    and (
      select coalesce(sum(coalesce(marketplace_order.gross_amount, marketplace_order.total)), 0)
      from public.marketplace_orders marketplace_order
      where marketplace_order.seller_id = seller.id
        and marketplace_order.status in ('paid', 'completed')
        and coalesce(marketplace_order.paid_at, marketplace_order.created_at) >=
          now() - make_interval(days => badge.evaluation_days)
    ) >= coalesce((badge.criteria->>'min_gross_sales')::numeric, 0)
    and (
      select count(*)
      from public.marketplace_product_reviews review
      join public.marketplace_products product on product.id = review.product_id
      where product.seller_id = seller.id
        and review.created_at >= now() - make_interval(days => badge.evaluation_days)
    ) >= coalesce((badge.criteria->>'min_review_count')::numeric, 0)
    and coalesce((
      select avg(review.rating)
      from public.marketplace_product_reviews review
      join public.marketplace_products product on product.id = review.product_id
      where product.seller_id = seller.id
        and review.created_at >= now() - make_interval(days => badge.evaluation_days)
    ), 0) >= coalesce((badge.criteria->>'min_average_rating')::numeric, 0)

  when 'highly_rated' then
    (
      select count(*)
      from public.marketplace_product_reviews review
      join public.marketplace_products product on product.id = review.product_id
      where product.seller_id = seller.id
        and review.created_at >= now() - make_interval(days => badge.evaluation_days)
    ) >= coalesce((badge.criteria->>'min_review_count')::numeric, 0)
    and coalesce((
      select avg(review.rating)
      from public.marketplace_product_reviews review
      join public.marketplace_products product on product.id = review.product_id
      where product.seller_id = seller.id
        and review.created_at >= now() - make_interval(days => badge.evaluation_days)
    ), 0) >= coalesce((badge.criteria->>'min_average_rating')::numeric, 0)

  when 'best_seller' then
    (
      select count(*)
      from (
        select
          product.id,
          product.seller_id,
          sum(order_item.quantity) as units_sold,
          row_number() over (order by sum(order_item.quantity) desc, product.id) as sales_rank
        from public.marketplace_order_items order_item
        join public.marketplace_orders marketplace_order on marketplace_order.id = order_item.order_id
        join public.marketplace_products product on product.id = order_item.product_id
        where marketplace_order.status in ('paid', 'completed')
          and coalesce(marketplace_order.paid_at, marketplace_order.created_at) >=
            now() - make_interval(days => badge.evaluation_days)
        group by product.id, product.seller_id
      ) ranked_product
      where ranked_product.seller_id = seller.id
        and ranked_product.sales_rank <= coalesce((badge.criteria->>'top_product_limit')::integer, 20)
        and ranked_product.units_sold >= coalesce((badge.criteria->>'min_units_sold')::numeric, 0)
    ) >= coalesce((badge.criteria->>'min_best_seller_products')::numeric, 1)

  when 'rising_creator' then
    seller.created_at >=
      now() - make_interval(days => coalesce((badge.criteria->>'max_seller_age_days')::integer, 365))
    and (
      select count(*)
      from public.marketplace_orders marketplace_order
      where marketplace_order.seller_id = seller.id
        and marketplace_order.status in ('paid', 'completed')
        and coalesce(marketplace_order.paid_at, marketplace_order.created_at) >=
          now() - make_interval(days => badge.evaluation_days)
    ) >= coalesce((badge.criteria->>'min_orders')::numeric, 0)
    and (
      with revenue_periods as (
        select
          coalesce(sum(coalesce(marketplace_order.gross_amount, marketplace_order.total, 0)) filter (
            where coalesce(marketplace_order.paid_at, marketplace_order.created_at) >=
              now() - make_interval(days => badge.evaluation_days)
          ), 0) as current_revenue,
          coalesce(sum(coalesce(marketplace_order.gross_amount, marketplace_order.total, 0)) filter (
            where coalesce(marketplace_order.paid_at, marketplace_order.created_at) <
              now() - make_interval(days => badge.evaluation_days)
          ), 0) as previous_revenue
        from public.marketplace_orders marketplace_order
        where marketplace_order.seller_id = seller.id
          and marketplace_order.status in ('paid', 'completed')
          and coalesce(marketplace_order.paid_at, marketplace_order.created_at) >=
            now() - make_interval(days => badge.evaluation_days * 2)
      )
      select case
        when previous_revenue = 0 and current_revenue > 0 then 100
        when previous_revenue = 0 then 0
        else ((current_revenue - previous_revenue) / previous_revenue) * 100
      end
      from revenue_periods
    ) >= coalesce((badge.criteria->>'min_growth_percent')::numeric, 0)

  when 'customer_favorite' then
    (
      select count(*)
      from public.marketplace_orders marketplace_order
      where marketplace_order.seller_id = seller.id
        and marketplace_order.status in ('paid', 'completed')
        and coalesce(marketplace_order.paid_at, marketplace_order.created_at) >=
          now() - make_interval(days => badge.evaluation_days)
    ) >= coalesce((badge.criteria->>'min_orders')::numeric, 0)
    and coalesce((
      with buyer_orders as (
        select marketplace_order.buyer_id, count(*) as order_count
        from public.marketplace_orders marketplace_order
        where marketplace_order.seller_id = seller.id
          and marketplace_order.status in ('paid', 'completed')
          and coalesce(marketplace_order.paid_at, marketplace_order.created_at) >=
            now() - make_interval(days => badge.evaluation_days)
        group by marketplace_order.buyer_id
      )
      select count(*) filter (where order_count >= 2) * 100.0 / nullif(count(*), 0)
      from buyer_orders
    ), 0) >= coalesce((badge.criteria->>'min_repeat_buyer_rate')::numeric, 0)

  when 'new_creator' then
    seller.created_at >=
      now() - make_interval(days => coalesce((badge.criteria->>'max_seller_age_days')::integer, 90))
  else false
end
order by seller.id, badge.priority, badge.badge_key;
$$;

revoke all on function public.marketplace_public_seller_badges(uuid[]) from public;
grant execute on function public.marketplace_public_seller_badges(uuid[]) to service_role;
