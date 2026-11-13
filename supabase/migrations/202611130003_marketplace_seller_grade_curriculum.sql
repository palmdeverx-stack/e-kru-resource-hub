begin;
alter table public.marketplace_grade_levels
 add column if not exists created_by uuid,
 add column if not exists first_used_at timestamptz,
 add column if not exists expires_at timestamptz;
alter table public.marketplace_curricula
 add column if not exists created_by uuid,
 add column if not exists first_used_at timestamptz,
 add column if not exists expires_at timestamptz;
create index if not exists marketplace_grade_levels_unused_expiry_idx on public.marketplace_grade_levels(expires_at) where created_by is not null and first_used_at is null;
create index if not exists marketplace_curricula_unused_expiry_idx on public.marketplace_curricula(expires_at) where created_by is not null and first_used_at is null;

create or replace function public.marketplace_mark_lookup_used()
returns trigger language plpgsql security definer set search_path = public as $$
declare lookup_id uuid; lookup_table text;
begin
 if tg_table_name = 'marketplace_product_grade_levels' then
   lookup_id := new.grade_level_id; lookup_table := 'marketplace_grade_levels';
 else
   lookup_id := new.curriculum_id; lookup_table := 'marketplace_curricula';
 end if;
 if lookup_id is null then return new; end if;
 execute format('select id from public.%I where id=$1 for update', lookup_table) using lookup_id;
 execute format('update public.%I set first_used_at=coalesce(first_used_at,now()),expires_at=null where id=$1 and created_by is not null',lookup_table) using lookup_id;
 return new;
end; $$;
create trigger marketplace_grade_level_first_use before insert or update of grade_level_id on public.marketplace_product_grade_levels
 for each row execute function public.marketplace_mark_lookup_used();
create trigger marketplace_curriculum_first_use before insert or update of curriculum_id on public.marketplace_products
 for each row execute function public.marketplace_mark_lookup_used();

create or replace function public.marketplace_cleanup_unused_lookups()
returns integer language plpgsql security definer set search_path = public as $$
declare lookup_table text; candidate record; used boolean; removed integer := 0;
begin
 foreach lookup_table in array array['marketplace_grade_levels','marketplace_curricula'] loop
   for candidate in execute format('select id from public.%I where created_by is not null and first_used_at is null and expires_at<=now() order by id for update skip locked',lookup_table) loop
     if lookup_table='marketplace_grade_levels' then
       select exists(select 1 from public.marketplace_product_grade_levels where grade_level_id=candidate.id) into used;
     else
       select exists(select 1 from public.marketplace_products where curriculum_id=candidate.id) into used;
     end if;
     if used then
       execute format('update public.%I set first_used_at=now(),expires_at=null where id=$1',lookup_table) using candidate.id;
     else
       execute format('delete from public.%I where id=$1',lookup_table) using candidate.id;
       removed := removed+1;
     end if;
   end loop;
 end loop;
 return removed;
end; $$;

create or replace function public.marketplace_create_seller_lookup(p_user_id uuid,p_kind text,p_name text,p_grade_group text default 'other')
returns jsonb language plpgsql security definer set search_path = public as $$
declare lookup_table text; normalized text; item record; owned integer; prefix text;
begin
 if p_kind not in ('grade-levels','curricula') or p_kind is null then raise exception 'ประเภทรายการไม่ถูกต้อง' using errcode='23514'; end if;
 if not exists(select 1 from public.marketplace_sellers where owner_id=p_user_id and status='active') then
   raise exception 'เฉพาะร้านค้าที่อนุมัติแล้วเท่านั้นที่เพิ่มรายการได้' using errcode='42501';
 end if;
 if p_grade_group is null or p_grade_group not in ('kindergarten','primary','secondary','other') then raise exception 'กลุ่มระดับชั้นไม่ถูกต้อง' using errcode='23514'; end if;
 lookup_table := case when p_kind='grade-levels' then 'marketplace_grade_levels' else 'marketplace_curricula' end;
 normalized := regexp_replace(btrim(p_name),'\s+',' ','g');
 if normalized is null or length(normalized)<2 or length(normalized)>80 then raise exception 'ชื่อต้องมี 2–80 ตัวอักษร' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtext('marketplace-community-lookups'));
 perform public.marketplace_cleanup_unused_lookups();
 execute format('select * from public.%I where lower(btrim(name))=lower($1) order by is_active desc limit 1',lookup_table) into item using normalized;
 if item.id is not null then
   if not item.is_active then raise exception 'รายการนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแล' using errcode='23514'; end if;
   return jsonb_build_object('item',to_jsonb(item),'reused',true);
 end if;
 execute format('select count(*) from public.%I where created_by=$1',lookup_table) into owned using p_user_id;
 if owned>=30 then raise exception 'เพิ่มรายการได้ไม่เกิน 30 รายการต่อประเภท' using errcode='23514'; end if;
 prefix := case when p_kind='grade-levels' then case p_grade_group when 'kindergarten' then 'k-' when 'primary' then 'p-' when 'secondary' then 'm-' else 'custom-' end else 'custom-' end;
 execute format('insert into public.%I(code,name,created_by,expires_at,sort_order,is_active) values($1,$2,$3,now()+interval ''24 hours'',999,true) returning *',lookup_table)
   into item using prefix||replace(gen_random_uuid()::text,'-',''),normalized,p_user_id;
 return jsonb_build_object('item',to_jsonb(item),'reused',false);
end; $$;
revoke all on function public.marketplace_mark_lookup_used() from public,anon,authenticated;
revoke all on function public.marketplace_cleanup_unused_lookups() from public,anon,authenticated;
revoke all on function public.marketplace_create_seller_lookup(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.marketplace_cleanup_unused_lookups() to service_role;
grant execute on function public.marketplace_create_seller_lookup(uuid,text,text,text) to service_role;
commit;
