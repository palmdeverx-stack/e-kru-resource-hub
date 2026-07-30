create table if not exists public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_username text,
  actor_role text,
  category text not null,
  action text not null,
  target_type text,
  target_id text,
  result text not null check (result in ('success', 'failure', 'denied')),
  ip_address text,
  user_agent text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists security_audit_logs_created_idx
  on public.security_audit_logs (created_at desc);
create index if not exists security_audit_logs_actor_idx
  on public.security_audit_logs (actor_id, created_at desc);
create index if not exists security_audit_logs_category_idx
  on public.security_audit_logs (category, created_at desc);
create index if not exists security_audit_logs_action_idx
  on public.security_audit_logs (action, created_at desc);
create index if not exists security_audit_logs_result_idx
  on public.security_audit_logs (result, created_at desc);

alter table public.security_audit_logs enable row level security;

revoke all on table public.security_audit_logs from anon, authenticated;

create or replace function public.prevent_security_audit_log_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'security audit logs are append-only';
end;
$$;

drop trigger if exists security_audit_logs_append_only on public.security_audit_logs;
create trigger security_audit_logs_append_only
before update or delete on public.security_audit_logs
for each row execute function public.prevent_security_audit_log_mutation();

