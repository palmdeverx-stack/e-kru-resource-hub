-- Atomic daily receipt numbers in YYYYMMDDXXXX format.

create table if not exists public.marketplace_receipt_number_counters (
  receipt_date date primary key,
  last_value integer not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now()
);

alter table public.marketplace_receipt_number_counters enable row level security;

create or replace function public.next_marketplace_receipt_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_date_thailand date := (now() at time zone 'Asia/Bangkok')::date;
  next_value integer;
begin
  insert into public.marketplace_receipt_number_counters (
    receipt_date,
    last_value,
    updated_at
  )
  values (current_date_thailand, 1, now())
  on conflict (receipt_date)
  do update
    set last_value = marketplace_receipt_number_counters.last_value + 1,
        updated_at = now()
  returning last_value into next_value;

  if next_value > 9999 then
    raise exception 'จำนวนใบเสร็จประจำวันเกิน 9,999 รายการ';
  end if;

  return to_char(current_date_thailand, 'YYYYMMDD') || lpad(next_value::text, 4, '0');
end;
$$;

revoke all on function public.next_marketplace_receipt_number() from public;
grant execute on function public.next_marketplace_receipt_number() to service_role;

