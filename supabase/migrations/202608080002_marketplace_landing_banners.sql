create table if not exists public.marketplace_landing_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 150),
  alt_text text not null default '' check (char_length(alt_text) <= 200),
  desktop_image_url text not null,
  mobile_image_url text,
  link_url text,
  sort_order integer not null default 0 check (sort_order between 0 and 999),
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists marketplace_landing_banners_active_idx
  on public.marketplace_landing_banners
    (is_active, sort_order asc, starts_at, ends_at);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketplace-landing-banner-assets',
  'marketplace-landing-banner-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.marketplace_landing_banners enable row level security;
