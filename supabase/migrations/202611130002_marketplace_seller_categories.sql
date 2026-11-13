begin;

alter table public.marketplace_categories
  add column if not exists created_by uuid,
  add column if not exists first_used_at timestamptz,
  add column if not exists expires_at timestamptz;

create index if not exists marketplace_categories_unused_expiry_idx
  on public.marketplace_categories(expires_at)
  where created_by is not null and first_used_at is null;

-- A product save counts as use, including a draft. Serialize use and cleanup
-- on the category row so cleanup can never remove a concurrently used category.
create or replace function public.marketplace_mark_category_used()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.category is null or btrim(new.category) = '' then return new; end if;
  perform 1 from public.marketplace_categories where name = new.category for update;
  if not found then
    raise exception 'หมวดหมู่นี้ไม่มีอยู่ กรุณาเลือกหมวดหมู่ใหม่' using errcode = '23514';
  end if;
  update public.marketplace_categories
  set first_used_at = coalesce(first_used_at, now()), expires_at = null
  where name = new.category and created_by is not null;
  return new;
end;
$$;

drop trigger if exists marketplace_product_category_used on public.marketplace_products;
create trigger marketplace_product_category_used
  before insert or update of category on public.marketplace_products
  for each row execute function public.marketplace_mark_category_used();

create or replace function public.marketplace_cleanup_unused_categories()
returns integer language plpgsql security definer set search_path = public as $$
declare candidate record; removed integer := 0;
begin
  for candidate in select id, name from public.marketplace_categories
    where created_by is not null and first_used_at is null and expires_at <= now()
    order by id for update skip locked
  loop
    if exists(select 1 from public.marketplace_products where category = candidate.name) then
      update public.marketplace_categories set first_used_at = now(), expires_at = null where id = candidate.id;
    else
      delete from public.marketplace_categories where id = candidate.id;
      removed := removed + 1;
    end if;
  end loop;
  return removed;
end;
$$;

create or replace function public.marketplace_create_seller_category(p_user_id uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare category public.marketplace_categories; normalized text;
begin
  if not exists(select 1 from public.marketplace_sellers where owner_id = p_user_id and status = 'active') then
    raise exception 'เฉพาะร้านค้าที่อนุมัติแล้วเท่านั้นที่เพิ่มหมวดหมู่ได้' using errcode = '42501';
  end if;
  normalized := regexp_replace(btrim(p_name), '\s+', ' ', 'g');
  if normalized is null or length(normalized) < 2 or length(normalized) > 80 then
    raise exception 'ชื่อหมวดหมู่ต้องมี 2–80 ตัวอักษร' using errcode = '23514';
  end if;
  -- Serialize community creation (including differently cased names) and quota checks.
  perform pg_advisory_xact_lock(hashtext('marketplace-community-categories'));
  perform public.marketplace_cleanup_unused_categories();
  select * into category from public.marketplace_categories
    where lower(btrim(name)) = lower(normalized) order by is_active desc limit 1;
  if found then
    if not category.is_active then
      raise exception 'หมวดหมู่นี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแล' using errcode = '23514';
    end if;
    return jsonb_build_object('category', to_jsonb(category), 'reused', true);
  end if;
  if (select count(*) from public.marketplace_categories where created_by = p_user_id) >= 30 then
    raise exception 'เพิ่มหมวดหมู่ได้ไม่เกิน 30 รายการต่อร้านค้า' using errcode = '23514';
  end if;
  insert into public.marketplace_categories(name, created_by, expires_at, sort_order, is_active)
    values(normalized, p_user_id, now() + interval '24 hours', 999, true) returning * into category;
  return jsonb_build_object('category', to_jsonb(category), 'reused', false);
end;
$$;

revoke all on function public.marketplace_mark_category_used() from public, anon, authenticated;
revoke all on function public.marketplace_cleanup_unused_categories() from public, anon, authenticated;
revoke all on function public.marketplace_create_seller_category(uuid, text) from public, anon, authenticated;
grant execute on function public.marketplace_cleanup_unused_categories() to service_role;
grant execute on function public.marketplace_create_seller_category(uuid, text) to service_role;
commit;
