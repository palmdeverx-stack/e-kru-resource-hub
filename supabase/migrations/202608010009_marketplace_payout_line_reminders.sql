alter table public.marketplace_line_settings
  add column if not exists notify_payout_due boolean not null default true;

alter table public.marketplace_line_deliveries
  add column if not exists dedupe_key text;

alter table public.marketplace_line_deliveries
  drop constraint if exists marketplace_line_deliveries_event_type_check;
alter table public.marketplace_line_deliveries
  add constraint marketplace_line_deliveries_event_type_check
  check (event_type in ('new_seller', 'product_approval', 'payout_due'));

alter table public.marketplace_line_deliveries
  drop constraint if exists marketplace_line_deliveries_status_check;
alter table public.marketplace_line_deliveries
  add constraint marketplace_line_deliveries_status_check
  check (status in ('processing', 'sent', 'failed', 'skipped'));

create unique index if not exists marketplace_line_deliveries_dedupe_key
  on public.marketplace_line_deliveries (dedupe_key)
  where dedupe_key is not null;
