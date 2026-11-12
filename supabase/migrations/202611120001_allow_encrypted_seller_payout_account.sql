-- The application stores the account number in account_number_encrypted and
-- deliberately clears its plaintext counterpart.
alter table public.marketplace_seller_payout_accounts
  alter column account_number drop not null;
