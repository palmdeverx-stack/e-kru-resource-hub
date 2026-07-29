create table if not exists public.marketplace_product_views (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  visitor_key text not null,
  viewer_id uuid,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  unique (product_id, visitor_key)
);
create index if not exists marketplace_product_views_product_idx
  on public.marketplace_product_views (product_id);

create table if not exists public.marketplace_product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  buyer_id uuid not null,
  reviewer_name text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, buyer_id)
);
create index if not exists marketplace_product_reviews_product_idx
  on public.marketplace_product_reviews (product_id, updated_at desc);

create table if not exists public.marketplace_product_downloads (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  product_file_id uuid not null references public.marketplace_product_files(id) on delete cascade,
  order_item_id uuid not null references public.marketplace_order_items(id) on delete cascade,
  buyer_id uuid not null,
  downloaded_at timestamptz not null default now()
);
create index if not exists marketplace_product_downloads_product_idx
  on public.marketplace_product_downloads (product_id, downloaded_at desc);
create index if not exists marketplace_product_downloads_buyer_idx
  on public.marketplace_product_downloads (buyer_id, downloaded_at desc);

alter table public.marketplace_product_views enable row level security;
alter table public.marketplace_product_reviews enable row level security;
alter table public.marketplace_product_downloads enable row level security;
