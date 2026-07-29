create table if not exists public.marketplace_product_collections (
  user_id uuid not null,
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  collection_type text not null check (collection_type in ('favorite', 'bookmark')),
  created_at timestamptz not null default now(),
  primary key (user_id, product_id, collection_type)
);

create index if not exists marketplace_product_collections_user_idx
  on public.marketplace_product_collections (user_id, collection_type, created_at desc);

alter table public.marketplace_product_collections enable row level security;
