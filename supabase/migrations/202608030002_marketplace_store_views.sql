create table if not exists public.marketplace_store_views (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  visitor_key text not null,
  viewer_id uuid,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  unique (seller_id, visitor_key)
);

create index if not exists marketplace_store_views_seller_idx
  on public.marketplace_store_views (seller_id, last_viewed_at desc);

alter table public.marketplace_store_views enable row level security;

create or replace function public.marketplace_public_store_view_counts(seller_ids uuid[])
returns table (seller_id uuid, view_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select requested.seller_id, count(store_view.id)::bigint as view_count
  from unnest(seller_ids) as requested(seller_id)
  left join public.marketplace_store_views store_view
    on store_view.seller_id = requested.seller_id
  group by requested.seller_id;
$$;

comment on function public.marketplace_public_store_view_counts(uuid[]) is
  'Returns unique storefront visitor counts for the requested public seller cards.';

revoke all on function public.marketplace_public_store_view_counts(uuid[]) from public;
revoke all on function public.marketplace_public_store_view_counts(uuid[]) from anon;
revoke all on function public.marketplace_public_store_view_counts(uuid[]) from authenticated;
grant execute on function public.marketplace_public_store_view_counts(uuid[]) to service_role;
