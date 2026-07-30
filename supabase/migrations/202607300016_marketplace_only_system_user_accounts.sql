-- Keep the Marketplace account-management screen isolated from the shared
-- school database. Dedicated Marketplace accounts are always included, while
-- E-KRU school accounts are included only after Marketplace activity exists.
create or replace view public.system_user_accounts
with (security_invoker = true)
as
select
  user_account.id,
  'app'::text as source,
  user_account.username,
  user_account.email,
  trim(concat_ws(' ', user_account.first_name, user_account.last_name)) as display_name,
  user_account.first_name,
  user_account.last_name,
  user_account.avatar_url,
  user_account.role,
  user_account.school_id,
  school.name as school_name,
  user_account.is_active,
  user_account.is_suspended,
  user_account.suspended_at,
  user_account.suspended_by,
  user_account.suspended_reason,
  user_account.created_at
from public.app_users user_account
left join public.schools school on school.id = user_account.school_id
where
  exists (
    select 1
    from public.marketplace_sellers seller
    where seller.owner_id = user_account.id
  )
  or exists (
    select 1
    from public.marketplace_orders marketplace_order
    where marketplace_order.buyer_id = user_account.id
  )
  or exists (
    select 1
    from public.marketplace_product_collections collection
    where collection.user_id = user_account.id
  )
  or exists (
    select 1
    from public.marketplace_product_views product_view
    where product_view.viewer_id = user_account.id
  )

union all

select
  marketplace_account.id,
  'marketplace'::text as source,
  marketplace_account.username,
  marketplace_account.email,
  coalesce(
    nullif(trim(marketplace_account.display_name), ''),
    trim(concat_ws(' ', marketplace_account.first_name, marketplace_account.last_name))
  ) as display_name,
  marketplace_account.first_name,
  marketplace_account.last_name,
  null::text as avatar_url,
  'marketplace_user'::text as role,
  null::uuid as school_id,
  null::text as school_name,
  marketplace_account.is_active,
  marketplace_account.is_suspended,
  marketplace_account.suspended_at,
  marketplace_account.suspended_by,
  marketplace_account.suspended_reason,
  marketplace_account.created_at
from public.marketplace_users marketplace_account;

revoke all on public.system_user_accounts from anon, authenticated;
grant select on public.system_user_accounts to service_role;
