-- Consolidate duplicate seller tags before enforcing a community-wide unique name.
with ranked_tags as (
  select
    id,
    first_value(id) over (
      partition by lower(name)
      order by (created_by is null) desc, created_at asc, id asc
    ) as canonical_id
  from public.marketplace_tags
), duplicate_usage as (
  select pt.product_id, ranked.canonical_id as tag_id, min(pt.created_at) as created_at
  from public.marketplace_product_tags pt
  join ranked_tags ranked on ranked.id = pt.tag_id
  where ranked.id <> ranked.canonical_id
  group by pt.product_id, ranked.canonical_id
)
insert into public.marketplace_product_tags (product_id, tag_id, created_at)
select product_id, tag_id, created_at
from duplicate_usage
on conflict (product_id, tag_id) do nothing;

with ranked_tags as (
  select
    id,
    first_value(id) over (
      partition by lower(name)
      order by (created_by is null) desc, created_at asc, id asc
    ) as canonical_id
  from public.marketplace_tags
)
delete from public.marketplace_product_tags usage
using ranked_tags ranked
where usage.tag_id = ranked.id
  and ranked.id <> ranked.canonical_id;

with tag_usage as (
  select lower(name) as normalized_name, min(first_used_at) as first_used_at
  from public.marketplace_tags
  where first_used_at is not null
  group by lower(name)
)
update public.marketplace_tags tag
set
  first_used_at = coalesce(tag.first_used_at, usage.first_used_at),
  expires_at = case when usage.first_used_at is null then tag.expires_at else null end
from tag_usage usage
where lower(tag.name) = usage.normalized_name;

with ranked_tags as (
  select
    id,
    first_value(id) over (
      partition by lower(name)
      order by (created_by is null) desc, created_at asc, id asc
    ) as canonical_id
  from public.marketplace_tags
)
delete from public.marketplace_tags tag
using ranked_tags ranked
where tag.id = ranked.id
  and ranked.id <> ranked.canonical_id;

drop index if exists public.marketplace_tags_system_name_lower_key;
drop index if exists public.marketplace_tags_owner_name_lower_key;

create unique index if not exists marketplace_tags_name_lower_key
  on public.marketplace_tags (lower(name));

comment on column public.marketplace_tags.created_by is
  'Original creator of a community tag. NULL means a Master tag; every active tag can be used by all sellers.';
