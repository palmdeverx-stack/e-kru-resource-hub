# Seller payout transactions

## Current flow

The platform collects customer payments through Stripe. Stripe's scheduled payout
moves available funds to the platform bank account. Seller payouts are a separate
manual bank workflow; these changes do not initiate a bank or Stripe transfer.

1. Create a pending payout from matured seller ledger entries. The database
   calculates the amount and minimum, snapshots the encrypted bank account and
   reserves the entries in one transaction.
2. Click **เริ่มโอนผ่านธนาคาร** before transferring. A bulk bank worksheet moves
   successfully prepared payouts to `processing` before exporting them.
3. Execute the actual transfer through the bank. Record `paid` with the bank
   reference, or `failed` only after confirming no money was transferred.
4. A successful result keeps its reservation. A failed result releases it in the
   same transaction as the status update. Repeating the identical result is
   idempotent; a conflicting completed result is rejected.

The finance PIN, master-admin check and same-origin mutation protection remain.
Normalized bank references are unique, including concurrent requests. Notification
failure after the financial commit does not report the transfer result as failed.
The RPCs are executable only by the service role, never anonymous/authenticated
browser roles.

## Refund handling

Stripe `charge.refunded` provides a cumulative refunded amount. The database
tracks that cumulative amount per charge under a payment-session lock, and records
only the incremental refund as immutable ledger rows. Stale or duplicate events
cannot subtract money again. Amounts use cents and rounded cumulative allocations
so the final refund exactly reverses each original seller sale/platform commission.

- Full refunds revoke purchased licenses and mark the order refunded.
- Partial refunds adjust money while keeping purchased access and paid order state.
- A pending, unstarted payout containing refunded revenue is cancelled and released
  atomically, so its outdated worksheet cannot be started afterwards.
- Processing and paid transfers retain their original amount/history. A new refund
  debit offsets future seller earnings. The application cannot reverse money that
  has already moved through an external bank. Finance must reconcile that case and
  confirm whether an in-progress bank transfer can still be stopped.
- Shipping refunds use the same cumulative ratio and transaction; partial refunds
  no longer refund the entire shipping fee or cancel an unshipped parcel immediately.
- If accounting commits but license revocation fails, webhook retry still performs
  revocation while skipping duplicate accounting.

Do not use a bank worksheet after its payout was cancelled. Check current status
before transferring. A browser status update does not verify a bank transfer by
itself. Stripe's bank destination and the manual payout source bank configured in
Marketplace finance settings are separate settings.

## Required rollout order

1. Apply `202611120005_atomic_seller_payouts.sql`. It adds the RPCs, cumulative
   refund totals, encrypted snapshot compatibility and four-column ledger index,
   while retaining the existing three-column index for the old application.
2. Deploy the new code: payment finalization and dispute upserts now target
   `order_id,account_scope,entry_type,refund_event_key`.
3. After old application requests have drained, apply
   `202611120006_enable_refund_ledger_deltas.sql`. It removes the old index so
   successive partial refunds can append separate immutable rows.
4. Verify the payout flow and refund callback on the deployed version. Until step
   3, a successive partial refund may fail on the old unique index and be retried
   by Stripe; never ignore a failed webhook delivery.

Migration 005 was staged in the configured Supabase database on 12 November 2026.
The original and new ledger indexes were both verified afterwards. No existing
payout amount, balance or bank account data was modified. A subsequent read-only
inspection on the same date confirmed migration 006 is now applied (old index
absent). The production code version still needs verification; see
`commerce-flow-audit.md`. No production deployment or
actual bank transfer was performed by this task.

Do not roll back to old code after removing the old index without restoring its
compatible conflict target. Once multiple refund rows exist, restoring the old
unique index requires a deliberate data migration; do not delete refund history.
Existing refunds processed by old code without ledger reversals are not backfilled
silently; review/reconcile historical data before operating with real balances.

## Verification

- Security/API tests: `corepack yarn test:security`.
- Real PostgreSQL tests: `tests/database/payout-transactions.test.mjs`, run only on
  an isolated empty database using a local Unix socket. The suite refuses a
  nonempty public schema and requires `PAYOUT_TEST_ISOLATED=1`.
- Tests cover simultaneous reservations, paid/failed races, identical retries,
  duplicate references, rollback on reserve/release errors, full/partial/duplicate/
  stale refunds, refunds after payment, preservation of settled partial-refund
  history, shipping allocations and denial of anonymous RPC access.
- PostgreSQL fixture tables are derived from repository DDL. They are not the
  production database and no real notification, bank call or payment is executed.
