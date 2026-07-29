-- In-app invitation notifications for Marketplace identities.
-- Raw email tokens remain hashed; in-app acceptance uses the authenticated
-- recipient plus invitation_id, so no reusable secret is stored in notifications.

alter table public.notifications
  drop constraint if exists notifications_user_id_fkey;
alter table public.notifications
  alter column school_id drop not null;
alter table public.notifications
  add column if not exists source_id uuid;

create unique index if not exists notifications_invitation_source_key
  on public.notifications (user_id, type, source_id)
  where source_id is not null and type = 'marketplace_school_invitation';

create or replace function public.notify_marketplace_school_invitation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  school_name text;
begin
  if new.accepted_at is not null
     or new.revoked_at is not null
     or new.expires_at <= now() then
    update public.notifications
    set read_at = coalesce(read_at, now())
    where user_id = new.marketplace_user_id
      and type = 'marketplace_school_invitation'
      and source_id = new.id;
    return new;
  end if;

  select name into school_name
  from public.schools
  where id = new.school_id;

  insert into public.notifications (
    user_id, school_id, type, title, body, link, source_id, read_at, created_at
  )
  values (
    new.marketplace_user_id,
    new.school_id,
    'marketplace_school_invitation',
    'มีคำเชิญเข้าร่วมโรงเรียน',
    coalesce(school_name, 'โรงเรียน') || ' เชิญคุณเข้าร่วมในฐานะ'
      || case new.membership_role
        when 'school_admin' then 'ผู้ดูแลโรงเรียน'
        when 'academic_admin' then 'ผู้ดูแลงานวิชาการ'
        else 'ครู'
      end,
    '/invitations/accept?id=' || new.id::text,
    new.id,
    null,
    now()
  )
  on conflict (user_id, type, source_id)
    where source_id is not null and type = 'marketplace_school_invitation'
  do update set
    school_id = excluded.school_id,
    title = excluded.title,
    body = excluded.body,
    link = excluded.link,
    read_at = null,
    created_at = now();

  return new;
end;
$$;

drop trigger if exists notify_marketplace_school_invitation_trigger
  on public.marketplace_school_invitations;
create trigger notify_marketplace_school_invitation_trigger
  after insert or update of expires_at, accepted_at, revoked_at
  on public.marketplace_school_invitations
  for each row execute function public.notify_marketplace_school_invitation();

-- Backfill pending invitations so they appear in the bell immediately.
insert into public.notifications (
  user_id, school_id, type, title, body, link, source_id
)
select
  invitations.marketplace_user_id,
  invitations.school_id,
  'marketplace_school_invitation',
  'มีคำเชิญเข้าร่วมโรงเรียน',
  schools.name || ' เชิญคุณเข้าร่วมในฐานะ'
    || case invitations.membership_role
      when 'school_admin' then 'ผู้ดูแลโรงเรียน'
      when 'academic_admin' then 'ผู้ดูแลงานวิชาการ'
      else 'ครู'
    end,
  '/invitations/accept?id=' || invitations.id::text,
  invitations.id
from public.marketplace_school_invitations invitations
join public.schools schools on schools.id = invitations.school_id
where invitations.accepted_at is null
  and invitations.revoked_at is null
  and invitations.expires_at > now()
on conflict (user_id, type, source_id)
  where source_id is not null and type = 'marketplace_school_invitation'
do nothing;

create or replace function public.accept_marketplace_school_invitation_by_id(
  invitation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_marketplace_user_id uuid;
  invitation_record public.marketplace_school_invitations%rowtype;
begin
  select id into current_marketplace_user_id
  from public.marketplace_users
  where auth_user_id = auth.uid();

  if current_marketplace_user_id is null then
    raise exception 'Marketplace account not found';
  end if;

  select * into invitation_record
  from public.marketplace_school_invitations
  where id = invitation_id
    and marketplace_user_id = current_marketplace_user_id
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if invitation_record.id is null then
    raise exception 'Invitation is invalid or expired';
  end if;

  insert into public.marketplace_school_members (
    school_id, marketplace_user_id, membership_role
  )
  values (
    invitation_record.school_id,
    invitation_record.marketplace_user_id,
    invitation_record.membership_role
  )
  on conflict (school_id, marketplace_user_id)
  do update set membership_role = excluded.membership_role;

  update public.marketplace_school_invitations
  set accepted_at = now()
  where id = invitation_record.id;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where user_id = current_marketplace_user_id
    and type = 'marketplace_school_invitation'
    and source_id = invitation_record.id;

  return invitation_record.school_id;
end;
$$;

revoke all on function public.accept_marketplace_school_invitation_by_id(uuid) from public;
grant execute on function public.accept_marketplace_school_invitation_by_id(uuid)
  to authenticated;
