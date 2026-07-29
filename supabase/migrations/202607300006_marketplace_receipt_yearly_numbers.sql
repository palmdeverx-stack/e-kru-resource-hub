-- Replace daily receipt numbering with an atomic yearly INV-YYYYXXXX sequence.

create table if not exists public.marketplace_receipt_year_counters (
  receipt_year smallint primary key check (receipt_year between 2000 and 9999),
  last_value integer not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now()
);

alter table public.marketplace_receipt_year_counters enable row level security;

create or replace function public.next_marketplace_receipt_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_year_thailand smallint :=
    extract(year from (now() at time zone 'Asia/Bangkok'))::smallint;
  next_value integer;
begin
  insert into public.marketplace_receipt_year_counters (
    receipt_year,
    last_value,
    updated_at
  )
  values (current_year_thailand, 1, now())
  on conflict (receipt_year)
  do update
    set last_value = marketplace_receipt_year_counters.last_value + 1,
        updated_at = now()
  returning last_value into next_value;

  if next_value > 9999 then
    raise exception 'จำนวนใบเสร็จประจำปีเกิน 9,999 รายการ';
  end if;

  return 'INV-' || current_year_thailand::text || lpad(next_value::text, 4, '0');
end;
$$;

revoke all on function public.next_marketplace_receipt_number() from public;
grant execute on function public.next_marketplace_receipt_number() to service_role;

