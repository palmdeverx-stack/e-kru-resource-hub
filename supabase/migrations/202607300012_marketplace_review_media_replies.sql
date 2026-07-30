create table if not exists public.marketplace_review_images (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.marketplace_product_reviews(id) on delete cascade,
  storage_bucket text not null default 'marketplace-review-images',
  storage_path text not null,
  mime_type text not null,
  file_size integer not null check (file_size > 0 and file_size <= 5242880),
  position smallint not null default 0 check (position between 0 and 2),
  created_at timestamptz not null default now(),
  unique (review_id, storage_path)
);
create index if not exists marketplace_review_images_review_idx
  on public.marketplace_review_images (review_id, position);

create table if not exists public.marketplace_review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique
    references public.marketplace_product_reviews(id) on delete cascade,
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  responder_id uuid not null,
  responder_name text not null,
  comment text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_review_replies_seller_idx
  on public.marketplace_review_replies (seller_id, updated_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketplace-review-images',
  'marketplace-review-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.marketplace_review_images enable row level security;
alter table public.marketplace_review_replies enable row level security;

