alter table public.marketplace_sellers
  add column if not exists pending_profile_data jsonb,
  add column if not exists profile_review_status text,
  add column if not exists profile_submitted_at timestamptz,
  add column if not exists profile_rejection_reason text;

alter table public.marketplace_sellers
  drop constraint if exists marketplace_sellers_profile_review_status_check;
alter table public.marketplace_sellers
  add constraint marketplace_sellers_profile_review_status_check
  check (profile_review_status is null or profile_review_status in ('draft', 'pending', 'rejected'));

create index if not exists marketplace_sellers_profile_review_pending_idx
  on public.marketplace_sellers (profile_submitted_at desc)
  where profile_review_status = 'pending';

comment on column public.marketplace_sellers.pending_profile_data is
  'Proposed seller profile and payout data. Public storefront continues using approved columns until review approval.';
