-- Bank account used by the platform finance team to pay seller payouts.
-- K BIZ credentials and OTPs must never be stored here.
alter table public.marketplace_finance_settings
  add column if not exists payout_bank_code text,
  add column if not exists payout_bank_name text,
  add column if not exists payout_account_number text,
  add column if not exists payout_account_name text;
