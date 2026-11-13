# Community product categories

Sellers with an active store can create a shared category from the product editor.
Names use React Hook Form + Zod validation (2–80 characters after normalization).
Existing names are reused case-insensitively. Inactive names cannot be recreated.
Creation is limited to 30 categories per user and rate-limited in the API.

A new category expires 24 hours after creation if it has never been saved on a
product. Saving a draft counts as use. A database trigger marks first use and
clears expiry. Later removal of the product does not reset this history.
System/admin categories (`created_by IS NULL`) never expire.

Cleanup runs on category reads and the existing daily
`/api/internal/marketplace-tags/cleanup` cron. The deadline makes a category
eligible for deletion; background physical deletion occurs on the next cleanup,
not at an exact per-category scheduled second. Row locks serialize first use and
cleanup. Cleanup rechecks existing product references before deleting.

## Rollout

1. Review and apply `supabase/migrations/202611130002_marketplace_seller_categories.sql`
   to the intended database before deploying the application changes.
2. Verify the new columns, functions, execute permissions, and product trigger in
   the target catalog. The create/cleanup RPCs are service-role only.
3. Test expiry boundaries and first-use retention in a rollback transaction with
   isolated fixtures on the target database.
4. Deploy and verify creation, reuse, draft save, and expiry behavior in the UI.

As checked on 2026-11-13, the connected database does not have `created_by` on
`marketplace_categories`. This migration has NOT been applied. Direct Postgres
catalog inspection was blocked by `SELF_SIGNED_CERT_IN_CHAIN`; obtain the database
CA from Supabase Database Settings and keep certificate/hostname verification
on. Do not disable TLS verification.

## Validation

- `node --test tests/security/seller-categories.test.mjs tests/security/product-form-validation.test.mjs tests/security/product-save-submit.test.mjs`
- `PGLITE_MODULE_PATH=/path/to/node_modules/@electric-sql/pglite node tests/database/seller-category-lifecycle.cjs`

The latter executes migration SQL against an isolated PGlite Postgres fixture.
It does not connect to production or establish that the migration is installed.
The PGlite package is a temporary verification dependency, not an app dependency.

## Grade levels and curricula

The product editor also opens the same creation dialog for grade levels and
curricula. Install `202611130003_marketplace_seller_grade_curriculum.sql` before
using these controls. Both use shared names, active-seller authorization,
30-item per-type limits, first-use triggers, and the same 24-hour cleanup rules.
Grade creation includes a learner group; generated code prefixes preserve the
existing kindergarten/primary/secondary catalog filters. Selecting an existing
name retains that item's original group.

`marketplace_product_grade_levels` marks grade first use;
`marketplace_products.curriculum_id` marks curriculum first use. Removing a
reference later does not make a once-used item expire. Lookup reads and the
existing cleanup cron delete expired unused entries.

Validation:
- `node --test tests/security/seller-lookups.test.mjs`
- `PGLITE_MODULE_PATH=/path/to/node_modules/@electric-sql/pglite node tests/database/seller-lookup-lifecycle.cjs`

The SQL migration is prepared but has not been installed in production.
