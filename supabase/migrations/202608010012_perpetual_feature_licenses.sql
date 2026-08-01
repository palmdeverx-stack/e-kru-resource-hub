-- Feature products may be sold either for a fixed number of days or as a
-- one-time perpetual purchase. A null duration/expiry represents perpetual
-- access and is deliberately distinct from an expired license.

alter table if exists public.marketplace_school_licenses
  alter column expires_at drop not null;

alter table if exists public.school_feature_purchases
  alter column expires_at drop not null;

alter table if exists public.marketplace_platform_licenses
  alter column duration_days drop not null,
  alter column expires_at drop not null;
