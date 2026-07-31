create index if not exists marketplace_product_collections_product_type_idx
  on public.marketplace_product_collections (product_id, collection_type);
