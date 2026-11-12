-- Run with psql -v ON_ERROR_STOP=1 or a single transaction-capable pg client.
-- Fixture rows are never committed. No storage objects or notifications are created.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';

do $$
declare
  product_id uuid;
  owner_id uuid;
  actual_file_id uuid;
  benefits jsonb;
  i integer;
begin
  if not exists (
    select 1 from pg_trigger where tgrelid = 'public.marketplace_product_files'::regclass
      and tgname = 'marketplace_product_file_limits' and tgenabled = 'O'
  ) then raise exception 'Migration 004 trigger missing or disabled'; end if;
  if not exists (
    select 1 from storage.buckets where id = 'marketplace-product-files'
      and public = false and file_size_limit = 10485760
  ) then raise exception 'Product file bucket policy mismatch'; end if;

  select id into owner_id from public.marketplace_sellers limit 1;
  if owner_id is null then raise exception 'Need an existing seller for rollback-only fixture'; end if;
  insert into public.marketplace_products(seller_id,title,description,status)
    values(owner_id,'Rollback-only upload limit verification','Isolated database validation','draft')
    returning id into product_id;
  select jsonb_agg('Benefit ' || n) into benefits from generate_series(1,10) n;
  update public.marketplace_products set purchase_benefits = benefits where id = product_id;
  begin
    update public.marketplace_products set purchase_benefits = benefits || '["Eleventh"]'::jsonb where id = product_id;
    raise exception 'Eleven benefits were accepted';
  exception when check_violation then null; end;
  begin
    update public.marketplace_products set purchase_benefits = '{}'::jsonb where id = product_id;
    raise exception 'Non-array benefits were accepted';
  exception when check_violation then null; end;
  raise notice 'PASS: ten benefits accepted; eleven and non-array rejected';

  for i in 1..5 loop
    insert into public.marketplace_product_files(product_id,storage_path,file_name,mime_type,file_size)
      values(product_id,'rollback-only/'||gen_random_uuid(), 'fixture.pdf','application/pdf',10485760)
      returning id into actual_file_id;
  end loop;
  begin
    insert into public.marketplace_product_files(product_id,storage_path,file_name,mime_type,file_size)
      values(product_id,'rollback-only/'||gen_random_uuid(),'sixth.pdf','application/pdf',1);
    raise exception 'Six actual files were accepted';
  exception when raise_exception then
    if sqlerrm <> 'Product file quota exceeded' then raise; end if;
  end;
  raise notice 'PASS: five actual files accepted; sixth rejected';

  insert into public.marketplace_product_files(product_id,storage_path,file_name,mime_type,file_size,is_preview)
    values(product_id,'rollback-only/'||gen_random_uuid(),'preview.pdf','application/pdf',10485760,true);
  begin
    insert into public.marketplace_product_files(product_id,storage_path,file_name,mime_type,file_size,is_preview)
      values(product_id,'rollback-only/'||gen_random_uuid(),'second-preview.pdf','application/pdf',1,true);
    raise exception 'Two preview files were accepted';
  exception when raise_exception then
    if sqlerrm <> 'Product file quota exceeded' then raise; end if;
  end;
  begin
    update public.marketplace_product_files set is_preview = true where id = actual_file_id;
    raise exception 'Moving actual file bypassed preview quota';
  exception when raise_exception then
    if sqlerrm <> 'Product file quota exceeded' then raise; end if;
  end;
  raise notice 'PASS: one preview accepted; second and move into full preview rejected';

  foreach i in array array[0,10485761] loop
    begin
      update public.marketplace_product_files set file_size = i where id = actual_file_id;
      raise exception 'Invalid file size was accepted: %',i;
    exception when raise_exception then
      if sqlerrm <> 'Product files must be between 1 byte and 10 MB' then raise; end if;
    end;
  end loop;
  raise notice 'PASS: 10 MiB accepted; zero bytes and 10 MiB + 1 rejected';
end;
$$;
rollback;
