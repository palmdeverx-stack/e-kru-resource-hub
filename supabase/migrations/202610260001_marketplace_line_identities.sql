-- LINE Login identities are separate from Messaging API notification recipients.
create table if not exists public.marketplace_line_identities (
  user_id uuid primary key references public.marketplace_users(id) on delete cascade,
  channel_id text not null,
  line_subject text not null,
  created_at timestamptz not null default now(),
  unique (channel_id, line_subject)
);
alter table public.marketplace_line_identities enable row level security;
revoke all on public.marketplace_line_identities from anon, authenticated;
grant all on public.marketplace_line_identities to service_role;
