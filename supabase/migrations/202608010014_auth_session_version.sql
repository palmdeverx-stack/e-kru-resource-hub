alter table public.app_users
  add column if not exists session_version integer not null default 0;

alter table public.marketplace_users
  add column if not exists session_version integer not null default 0;

-- Invalidate access tokens issued before this migration. Those tokens do not carry
-- a session version and are interpreted as version 0 by the application.
update public.app_users
set session_version = 1
where session_version = 0;

update public.marketplace_users
set session_version = 1
where session_version = 0;

create or replace function public.bump_app_user_session_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.session_version = old.session_version
     and (
       new.role is distinct from old.role
       or new.school_id is distinct from old.school_id
       or new.password_hash is distinct from old.password_hash
       or new.is_active is distinct from old.is_active
       or new.is_suspended is distinct from old.is_suspended
       or new.student_status is distinct from old.student_status
     ) then
    new.session_version := old.session_version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists bump_app_user_session_version on public.app_users;
create trigger bump_app_user_session_version
before update on public.app_users
for each row execute function public.bump_app_user_session_version();

create or replace function public.bump_marketplace_user_session_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.session_version = old.session_version
     and (
       new.is_active is distinct from old.is_active
       or new.is_suspended is distinct from old.is_suspended
       or new.auth_user_id is distinct from old.auth_user_id
     ) then
    new.session_version := old.session_version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists bump_marketplace_user_session_version on public.marketplace_users;
create trigger bump_marketplace_user_session_version
before update on public.marketplace_users
for each row execute function public.bump_marketplace_user_session_version();
