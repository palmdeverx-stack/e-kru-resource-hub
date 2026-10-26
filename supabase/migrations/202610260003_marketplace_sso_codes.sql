create table if not exists public.marketplace_sso_codes (
  code_hash text primary key,
  actor jsonb not null,
  challenge text not null,
  redirect_uri text not null,
  expires_at timestamptz not null
);
alter table public.marketplace_sso_codes enable row level security;
revoke all on public.marketplace_sso_codes from public, anon, authenticated;
grant all on public.marketplace_sso_codes to service_role;

create or replace function public.consume_marketplace_sso_code(
  p_code_hash text, p_challenge text, p_redirect_uri text
) returns jsonb language sql security definer set search_path = public, pg_temp as $$
  delete from public.marketplace_sso_codes
  where code_hash = p_code_hash and challenge = p_challenge
    and redirect_uri = p_redirect_uri and expires_at > now()
  returning actor;
$$;
revoke all on function public.consume_marketplace_sso_code(text,text,text) from public, anon, authenticated;
grant execute on function public.consume_marketplace_sso_code(text,text,text) to service_role;
