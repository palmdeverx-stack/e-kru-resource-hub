create table if not exists public.marketplace_popup_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  image_url text,
  link_url text,
  button_label text,
  audience text not null default 'all'
    check (audience in ('all', 'authenticated', 'guests', 'roles')),
  role_targets text[] not null default '{}',
  priority integer not null default 0 check (priority between 0 and 999),
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists marketplace_popup_announcements_active_idx
  on public.marketplace_popup_announcements
    (is_active, priority desc, starts_at, ends_at);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketplace-announcement-assets',
  'marketplace-announcement-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.marketplace_popup_announcements enable row level security;

