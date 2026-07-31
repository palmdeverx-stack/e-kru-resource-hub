-- Keep the payout source bank aligned with the same BOT code used by sellers.
alter table public.marketplace_finance_settings
  add column if not exists payout_bank_code text;
