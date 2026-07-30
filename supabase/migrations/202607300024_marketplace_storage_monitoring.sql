create table if not exists public.marketplace_storage_settings (
  id text primary key default 'default' check (id = 'default'),
  capacity_bytes bigint not null default 1073741824 check (capacity_bytes > 0),
  warning_percent integer not null default 80 check (warning_percent between 1 and 99),
  critical_percent integer not null default 90 check (critical_percent between 2 and 100),
  updated_at timestamptz not null default now(),
  check (critical_percent > warning_percent)
);

insert into public.marketplace_storage_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.marketplace_storage_settings enable row level security;

create or replace function public.marketplace_storage_usage_summary()
returns table (
  bucket_id text,
  object_count bigint,
  total_bytes bigint,
  largest_object_bytes bigint,
  last_uploaded_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, public, storage
as $$
  select
    objects.bucket_id,
    count(*)::bigint as object_count,
    coalesce(sum(coalesce((objects.metadata ->> 'size')::bigint, 0)), 0)::bigint as total_bytes,
    coalesce(max(coalesce((objects.metadata ->> 'size')::bigint, 0)), 0)::bigint
      as largest_object_bytes,
    max(objects.created_at) as last_uploaded_at
  from storage.objects as objects
  group by objects.bucket_id
  order by total_bytes desc;
$$;

revoke all on function public.marketplace_storage_usage_summary() from public;
revoke all on function public.marketplace_storage_usage_summary() from anon;
revoke all on function public.marketplace_storage_usage_summary() from authenticated;
grant execute on function public.marketplace_storage_usage_summary() to service_role;
