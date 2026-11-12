# Product → payment → seller payout review

Reviewed 12 November 2026. This is a code review, mocked handler integration,
and read-only inspection of the configured database. No real product was
published, customer charged, payout created, or money transferred by this review.

## Current business policy (database, not fallback defaults)

- Regular-seller platform commission: 7%; a seller override or official-store
  rule can change the effective rate.
- Seller funds held for 3 days after verified payment.
- Minimum seller payout: THB 300.
- Seller payment schedule: Friday. This is a schedule/reminder, not an automated
  bank transfer or a strict server-side prohibition on other days.
- Stripe payouts into the platform bank are a separate Monday weekly schedule.

## Flow and evidence

| Stage | Current behavior | Verification |
| --- | --- | --- |
| Create product | Authenticated owner of an active store creates a draft | Read product POST/ownership guards |
| Attach content | Signed direct file upload; size/quota/owner/ticket checks | Existing upload/security tests |
| Submit | Required description/lookups/images/benefits/files/attestations checked; ordinary seller becomes pending_review | Read product manage PATCH and form schema; existing validation tests |
| Publish | Master admin approval publishes; official seller can publish on submission | Read admin review and submit paths; not exercised against real catalog |
| Purchase | Server loads published products and prices, checks access, creates pending order/session | Read orders POST; checkout session in lifecycle tests is a fixture |
| Verify payment | Signed callback checks session, amount and currency before finalization | Existing actual-handler integration with mocked storage/database/provider reads |
| Credit seller | Sale ledger contains seller net after platform commission and processor fee; funds mature after hold | Mocked actual finalizer and read code |
| Reach minimum | DB RPC sums eligible unreserved ledger, enforces minimum, reserves funds atomically | Isolated PostgreSQL transaction tests from prior payout fix |
| Execute transfer | Admin starts processing, transfers through bank manually, then records bank reference | API tests/SQL state tests; no actual bank execution |
| Refund/retry | Immutable refund deltas, idempotent callbacks, concurrent reservation/finalization protection | Existing security tests and isolated DB tests |

Security/API suite re-run: 148 passing tests. Earlier isolated PostgreSQL payout
suite: 12 scenario subtests passing (13 reported test nodes including parent).
A mocked THB 100 sale with commission THB 7 and an **assumed** processor fee THB 3
produced THB 90 both on the order and seller ledger. This is an arithmetic example,
not Stripe's quoted processing fee. Retrying after an injected evidence failure
preserved the ledger/order amount in the simulated scenario.

## Findings that still prevent an unqualified production-ready claim

### 1. Test revenue is eligible for real manual payout

Read-only database inspection found one unreserved, matured seller-ledger entry
from a verified `cs_test_...` checkout, totaling THB 15. Both the admin listing
and the reservation RPC filter maturity/reservation but do not isolate Stripe
Test/Live mode or merchant account. THB 15 alone is below the minimum, but it can
combine with real earnings and enter a later payout.

Do not silently delete this accounting history. Separate test/account provenance
and reconcile historical balances before allowing real seller disbursements.
Relevant code: admin/payouts GET and migration 202611120005 reservation query.

### 2. Pending malware scans do not block publication/delivery

The configured database has three pending_scan files, currently on archived
products. Stored scanner host and local CLAMAV_HOST fallback are unset. This
review did not establish a different scanner host in deployed environment values.
Submission rejects `rejected` only; admin approval does not recheck the scan state;
the download route also blocks only `rejected`. An actual-handler simulation for
a paid order with pending_scan returned a signed redirect (307).

Require a successful scan before publication/public preview/purchased download,
and ensure approval cannot bypass that requirement. The current archived files
are not evidence of a newly published unsafe product.

### 3. Unavailable Stripe processor fee is silently treated as zero

`getProcessorDetails` returns fee 0 when its Stripe request throws or the expanded
balance transaction is missing. The payment can proceed with this value. A local
simulation of a provider error confirmed `{ fee: 0, snapshot: null }`.
This can credit more seller revenue than the actual net. Reconcile the real fee
or keep its financial amount pending; do not treat an unavailable fee as known zero.

## Migration/deployment status

Read-only index inspection now finds the four-column refund index and no old
three-column index: migration 006 has been applied since the previous payout
report. The previously written pending status is superseded by this inspection.
Production must use the new four-column upsert targets; this review did not
establish which source version currently serves production. Old code targeting
only three columns would fail to insert/upsert sale and dispute ledger entries.

Real-provider/browser verification still required: approved product purchase,
actual signed webhook delivery, purchased content/entitlement, and bank-reference
reconciliation. A passing unit suite or reaching checkout does not establish
this entire real-world path.
