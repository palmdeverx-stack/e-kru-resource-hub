-- LINE-only members authenticate through marketplace_line_identities.
-- Do not invent an email address or a Supabase password for them.
alter table public.marketplace_users alter column auth_user_id drop not null;
alter table public.marketplace_users alter column email drop not null;
alter table public.marketplace_users add column if not exists accepted_legal_at timestamptz;

create or replace function public.register_marketplace_line_member(
  p_channel_id text, p_subject text, p_first_name text, p_last_name text
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  member_id uuid;
begin
  if nullif(trim(p_channel_id), '') is null or nullif(trim(p_subject), '') is null
    or char_length(trim(p_first_name)) not between 1 and 100
    or char_length(trim(p_last_name)) not between 1 and 100
    or p_first_name is null or p_last_name is null then
    raise exception 'Invalid registration data';
  end if;
  -- Serialize registration of the same verified LINE identity across requests.
  perform pg_advisory_xact_lock(hashtextextended(p_channel_id || ':' || p_subject, 0));
  select user_id into member_id from public.marketplace_line_identities
    where channel_id = p_channel_id and line_subject = p_subject;
  if member_id is not null then return member_id; end if;
  member_id := gen_random_uuid();
  insert into public.marketplace_users (
    id, username, first_name, last_name, display_name, role, is_active, accepted_legal_at
  ) values (
    member_id, 'line_' || replace(member_id::text, '-', ''),
    trim(p_first_name), trim(p_last_name), trim(p_first_name) || ' ' || trim(p_last_name),
    'marketplace_user', true, now()
  );
  insert into public.marketplace_line_identities (user_id, channel_id, line_subject)
    values (member_id, p_channel_id, p_subject);
  return member_id;
end;
$$;
revoke all on function public.register_marketplace_line_member(text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_marketplace_line_member(text, text, text, text) to service_role;
