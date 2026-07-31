alter table public.marketplace_tags
  add column if not exists created_by uuid,
  add column if not exists first_used_at timestamptz,
  add column if not exists expires_at timestamptz;

drop index if exists public.marketplace_tags_name_lower_key;

create unique index if not exists marketplace_tags_system_name_lower_key
  on public.marketplace_tags (lower(name))
  where created_by is null;

create unique index if not exists marketplace_tags_owner_name_lower_key
  on public.marketplace_tags (created_by, lower(name))
  where created_by is not null;

create index if not exists marketplace_tags_unused_expiry_idx
  on public.marketplace_tags (expires_at)
  where created_by is not null and first_used_at is null;

comment on column public.marketplace_tags.created_by is
  'User ID that created a seller-owned tag. NULL means a Master tag.';
comment on column public.marketplace_tags.first_used_at is
  'First time the tag was assigned to a product. Once set, sellers cannot delete the tag.';
comment on column public.marketplace_tags.expires_at is
  'Unused seller tags are eligible for automatic deletion after this timestamp.';
