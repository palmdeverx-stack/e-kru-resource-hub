alter table public.marketplace_sellers
  add column if not exists commission_rate_override numeric(5, 2);

alter table public.marketplace_sellers
  drop constraint if exists marketplace_sellers_commission_rate_override_check;
alter table public.marketplace_sellers
  add constraint marketplace_sellers_commission_rate_override_check
  check (
    commission_rate_override is null
    or (commission_rate_override >= 0 and commission_rate_override <= 100)
  );

comment on column public.marketplace_sellers.commission_rate_override is
  'Optional seller-specific platform commission. NULL uses marketplace_finance_settings default.';
