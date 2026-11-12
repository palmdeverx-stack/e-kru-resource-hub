-- Enforce quotas atomically for multipart and direct uploads, and preview moves.
create or replace function public.enforce_marketplace_product_file_limits()
returns trigger language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.product_id::text, 0));
  if new.file_size <= 0 or new.file_size > 10485760 then
    raise exception 'Product files must be between 1 byte and 10 MB';
  end if;
  if (select count(*) from public.marketplace_product_files
      where product_id = new.product_id and is_preview = new.is_preview
      and id <> new.id) >= (case when new.is_preview then 1 else 5 end) then
    raise exception 'Product file quota exceeded';
  end if;
  return new;
end;
$$;
drop trigger if exists marketplace_product_file_limits on public.marketplace_product_files;
create trigger marketplace_product_file_limits
before insert or update of product_id, is_preview, file_size
on public.marketplace_product_files for each row
execute function public.enforce_marketplace_product_file_limits();

-- Pending direct uploads are private and capped even before application verification.
update storage.buckets set public = false, file_size_limit = 10485760
where id = 'marketplace-product-files';
