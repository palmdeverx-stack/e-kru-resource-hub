-- Read only the original Auth provider for the accounts on the current admin page.
create or replace function public.system_account_registration_channels(
  app_ids uuid[], marketplace_ids uuid[]
)
returns table (id uuid, source text, signup_channel text)
language sql stable security definer set search_path = public
as $$
  select account.id, 'app'::text,
    coalesce(nullif(identity.raw_app_meta_data->>'provider', ''), 'system')
  from public.app_users account
  left join auth.users identity on identity.id = account.auth_user_id
  where account.id = any(app_ids)
  union all
  select account.id, 'marketplace'::text,
    coalesce(nullif(identity.raw_app_meta_data->>'provider', ''), 'unknown')
  from public.marketplace_users account
  left join auth.users identity on identity.id = account.auth_user_id
  where account.id = any(marketplace_ids);
$$;
revoke all on function public.system_account_registration_channels(uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.system_account_registration_channels(uuid[], uuid[]) to service_role;
