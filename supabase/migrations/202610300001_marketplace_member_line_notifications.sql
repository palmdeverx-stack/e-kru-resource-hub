alter table public.marketplace_line_settings
  add column if not exists notify_new_member boolean not null default true;

alter table public.marketplace_line_deliveries
  drop constraint if exists marketplace_line_deliveries_event_type_check;
alter table public.marketplace_line_deliveries
  add constraint marketplace_line_deliveries_event_type_check
  check (event_type in ('new_member', 'new_seller', 'product_approval', 'payout_due'));
