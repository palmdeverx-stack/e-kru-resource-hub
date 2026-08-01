-- Keep application roles scoped to their product. E-KRU's Supabase Auth role
-- remains `super_admin`; only the Marketplace application role is renamed.
do $$
declare
  role_constraint record;
begin
  for role_constraint in
    select check_constraint.constraint_name as constraint_name
    from information_schema.check_constraints check_constraint
    join information_schema.constraint_column_usage column_usage
      on column_usage.constraint_schema = check_constraint.constraint_schema
      and column_usage.constraint_name = check_constraint.constraint_name
    where column_usage.table_schema = 'public'
      and column_usage.table_name = 'app_users'
      and column_usage.column_name = 'role'
  loop
    execute format(
      'alter table public.app_users drop constraint %I',
      role_constraint.constraint_name
    );
  end loop;
end
$$;

update public.app_users
set role = 'marketplace_admin'
where role = 'super_admin';

alter table public.app_users
  add constraint app_users_role_check
  check (
    role in (
      'master_admin', 'marketplace_admin', 'school_admin', 'teacher', 'student',
      'marketplace_user'
    )
  );

alter table public.marketplace_sellers
  drop constraint if exists marketplace_sellers_owner_role_check;

update public.marketplace_sellers
set owner_role = 'marketplace_admin'
where owner_role = 'super_admin';

alter table public.marketplace_sellers
  add constraint marketplace_sellers_owner_role_check
  check (
    owner_role in (
      'master_admin', 'marketplace_admin', 'school_admin', 'teacher', 'student',
      'marketplace_user'
    )
  );

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
  user_account.role in ('master_admin', 'marketplace_admin')
  or exists (
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

-- Refresh the deployed badge function without duplicating its long scoring query.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(procedure.oid)
  into function_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'marketplace_public_seller_badges'
    and procedure.pronargs = 1
  limit 1;

  if function_definition is not null then
    execute replace(
      function_definition,
      $old$'master_admin', 'super_admin'$old$,
      $new$'master_admin', 'marketplace_admin'$new$
    );
  end if;
end
$$;
