# Production verification — 12 November 2026

## Dependency fixes

- Next.js 16.4.6, MapLibre 6.18.0, all direct Tiptap packages 3.33.1, Zod 4.6.7.
- Patched ProseMirror View 1.42.9 and Markdown-it 14.3.3 are resolved consistently.
- Keep Node 24 and Yarn 1.22.22; use `corepack yarn install --frozen-lockfile`.
- Tiptap's `Fragment` and `liftTarget` exports were checked against the installed packages.
- Final complete-tree audit: 0 critical, 0 high, 0 moderate, 1 low. The remaining
  low advisory is `deepmerge` through `@svgr/webpack` → `@svgr/plugin-svgo`, with
  no published patched version. It is used by the build tool, not the production
  request handlers. Keep SVG build inputs/configuration trusted and recheck
  upstream before accepting untrusted SVG build jobs.
- Runtime dependency audit reports no known advisories.
- The scoped minimatch resolution moves TypeScript ESLint's named-export API
  from v9 to patched v11; it deliberately leaves v3 callers on their compatible
  patched release. Lint verifies the installed toolchain runs successfully.

## Repeatable checks

```bash
corepack yarn audit --groups dependencies
corepack yarn audit
corepack yarn lint
corepack yarn test:security
corepack yarn build
```

The security test suite passes 126 tests. `tests/security/purchase-lifecycle.test.mjs` executes the real signup, OTP,
Stripe webhook, payment finalization, license grant and download handlers together.
Stripe signatures use the real SDK. Database, mail, storage and secondary
notifications are isolated test substitutes; checkout-session creation is a fixture.
It covers duplicate callbacks, bad signatures, wrong amount/currency/session,
fulfillment retry, another buyer, refunded orders and rejected files.
This is not a real browser-to-provider E2E test.

## Database verification

Migrations 202611120003 and 202611120004 were confirmed in the configured Supabase
database using the certificate downloaded from its Database Settings. TLS chain
and hostname verification remained enabled. Confirmed:

- Purchase benefits check requires an array with at most 10 items.
- Enabled trigger enforces five actual files and one preview per product.
- Trigger function uses a transaction advisory lock for each product.
- Product-file bucket is private and capped at 10,485,760 bytes.

`tests/database/product-upload-limits.sql` was executed successfully against that
database. It accepts the exact limits and rejects 11 benefits, non-array benefits,
a sixth actual file, a second preview, moving into a full preview slot, zero bytes
and 10 MiB + 1 byte. All fixture rows were rolled back, with no storage uploads.
To repeat, use psql with `ON_ERROR_STOP=1`, the correct project connection string,
`sslmode=verify-full` and the downloaded CA certificate. Never commit credentials.

## Browser verification and remaining scope

On the production build at localhost:8800, an existing account logged in and
successfully opened a product, added it to the cart and reached checkout.
The configured Stripe key was Test mode. No payment was submitted.
The user deferred the complete Stripe changes and Live mode migration to the next task.

Still requires an actual provider test before claiming full E2E readiness:

- New-account signup and delivery/entry of the real email OTP.
- Stripe checkout completion, delivery of the real signed webhook and verified order.
- License availability and a purchased file downloaded through the browser.

Production email configuration and scanner readiness are separate outstanding
release items; this work does not claim to resolve them or deploy the changes.
