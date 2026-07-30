-- Central account suspension state for school and Marketplace identities.
-- marketplace_users.is_active remains reserved for email verification.

alter table public.app_users
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid,
  add column if not exists suspended_reason text;

alter table public.marketplace_users
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid,
  add column if not exists suspended_reason text;

create index if not exists app_users_suspension_created_idx
  on public.app_users (is_suspended, created_at desc);

create index if not exists marketplace_users_suspension_created_idx
  on public.marketplace_users (is_suspended, created_at desc);
