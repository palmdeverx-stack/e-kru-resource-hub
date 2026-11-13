-- One service-role request for public store cards. Private completion inputs never leave SQL.
create or replace function public.marketplace_public_store_directory(
  search_text text default '', page_number integer default 1, page_size integer default 24
) returns jsonb
language sql stable security definer set search_path = public
as $$
with options as (
  select greatest(1, coalesce(page_number, 1))::bigint as page,
    least(48, greatest(1, coalesce(page_size, 24))) as size,
    left(trim(coalesce(search_text, '')), 120) as search
), eligible as materialized (
  select s.* from public.marketplace_sellers s, options o
  where s.status = 'active' and s.owner_role <> 'master_admin'
    and (o.search = '' or s.display_name ilike '%' || o.search || '%'
      or s.display_name_en ilike '%' || o.search || '%')
), selected as materialized (
  select * from eligible order by display_name, id
  limit (select size from options)
  offset (select (page - 1) * size from options)
), ids as (
  select coalesce(array_agg(id), '{}'::uuid[]) as values from selected
), views as (
  select v.* from ids, public.marketplace_public_store_view_counts(ids.values) v
), badges as (
  select b.seller_id, jsonb_agg(to_jsonb(b) order by b.priority, b.badge_key) as badges
  from ids, public.marketplace_public_seller_badges(ids.values) b group by b.seller_id
), cards as (
  select s.display_name, s.id, jsonb_build_object(
    'id', s.id, 'display_name', s.display_name, 'display_name_en', s.display_name_en,
    'slug', s.slug, 'logo_url', s.logo_url, 'cover_url', s.cover_url,
    'bio', s.bio, 'seller_type', s.seller_type, 'is_system_store', false,
    'profile_completion', 10 * (
      (coalesce(s.display_name, '') <> '')::int + (coalesce(s.bio, '') <> '')::int +
      (coalesce(s.logo_url, '') <> '')::int + (coalesce(s.cover_url, '') <> '')::int +
      (coalesce(s.seller_name, '') <> '')::int + (coalesce(s.phone, '') <> '')::int +
      (coalesce(s.contact_email, '') <> '')::int +
      (exists(select 1 from public.marketplace_seller_documents d where d.seller_id = s.id))::int +
      (exists(select 1 from public.marketplace_seller_payout_accounts a where a.seller_id = s.id))::int +
      (s.seller_agreement_accepted_at is not null and s.copyright_confirmed_at is not null
        and s.fee_agreement_accepted_at is not null and s.pdpa_accepted_at is not null)::int
    ),
    'product_count', (select count(*) from public.marketplace_products p where p.seller_id = s.id and p.status = 'published'),
    'review_count', ratings.count, 'average_rating', coalesce(ratings.average, 0),
    'view_count', coalesce(v.view_count, 0), 'badges', coalesce(b.badges, '[]'::jsonb)
  ) as card
  from selected s
  left join views v on v.seller_id = s.id
  left join badges b on b.seller_id = s.id
  cross join lateral (
    select count(r.rating) as count, avg(r.rating) as average
    from public.marketplace_products p
    join public.marketplace_product_reviews r on r.product_id = p.id
    where p.seller_id = s.id and p.status = 'published'
  ) ratings
)
select jsonb_build_object(
  'stores', coalesce((select jsonb_agg(card order by display_name, id) from cards), '[]'::jsonb),
  'total', (select count(*) from eligible), 'page', o.page,
  'totalPages', ceil((select count(*) from eligible)::numeric / o.size)::bigint
) from options o;
$$;

revoke all on function public.marketplace_public_store_directory(text, integer, integer) from public, anon, authenticated;
grant execute on function public.marketplace_public_store_directory(text, integer, integer) to service_role;
