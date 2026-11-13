# Page performance audit - 2026-11-13 (Asia/Bangkok)

Scope: all 88 page routes found in src/app. Static source/import review and production HTTP GETs with no authenticated session, concurrency 3, redirects not followed. No business data changed.

## Observed coverage

- 19 HTTP 200 responses; 54 HTTP 307 redirects to sign-in; 12 dynamic routes require valid fixtures; 3 auth flows require session/token.
- No 4xx/5xx responses among the 73 requested routes. HTTP 200 does not verify client hydration, API calls, UI, permissions, or authenticated performance.
- Timings are one sample per route from this machine to production, including transport; they are not SQL time or browser LCP/INP.
- Static API references include unused functions from shared modules and cannot be interpreted as network request counts.

## Shared findings and changes

- Admin header previously fetched full seller profiles plus three status counts on every route change: count-only query and reduced navigation-triggered reloads.
- Notification read receipts previously flushed all active screen caches: now only notification transport cache is cleared; the menu invalidates its own observer.
- Notification query keys now include user and role, and polling is disabled before authentication.
- Product image metadata and product authorization are loaded with one joined query, retaining unpublished-image access checks.
- Fresh session revocation checks and payment/finance/license freshness remain in place.

## Verification limits

- Protected routes were checked for redirects only. Authenticated browser/API performance still needs valid sessions for each role.
- Dynamic routes need appropriate existing fixtures and valid tokens; no guessed tokens or data mutations were used.
- No production build was run over the existing user-owned development server .next directory. No server restart or deployment.
- Browser Network/Performance and LCP/INP are still required before claiming that every page is fast.

## Every route

| Route | HTTP | Headers ms | Total ms | Coverage |
| --- | --- | ---: | ---: | --- |
| `/` | 200 | 321 | 336 | HTTP only; client JS not executed |
| `/about` | 200 | 139 | 154 | HTTP only; client JS not executed |
| `/auth/google/callback` | skipped | - | - | authentication flow requires session or token |
| `/auth/line` | skipped | - | - | authentication flow requires session or token |
| `/auth/sign-in` | 200 | 581 | 593 | HTTP only; client JS not executed |
| `/auth/sign-up` | 200 | 426 | 432 | HTTP only; client JS not executed |
| `/auth/verify-email` | skipped | - | - | authentication flow requires session or token |
| `/cart` | 200 | 153 | 164 | HTTP only; client JS not executed |
| `/checkout` | 307 | 57 | 57 | redirect to /auth/sign-in |
| `/checkout/payment/[id]` | skipped | - | - | dynamic route requires valid fixture |
| `/checkout/success` | 307 | 51 | 51 | redirect to /auth/sign-in |
| `/contact` | 200 | 215 | 220 | HTTP only; client JS not executed |
| `/cookie-policy` | 200 | 185 | 187 | HTTP only; client JS not executed |
| `/copyright-takedown-policy` | 200 | 104 | 112 | HTTP only; client JS not executed |
| `/dashboard` | 307 | 230 | 230 | redirect to /auth/sign-in |
| `/dashboard/cart` | 307 | 71 | 72 | redirect to /auth/sign-in |
| `/dashboard/checkout` | 307 | 119 | 120 | redirect to /auth/sign-in |
| `/dashboard/checkout/success` | 307 | 56 | 56 | redirect to /auth/sign-in |
| `/dashboard/feedback` | 307 | 68 | 68 | redirect to /auth/sign-in |
| `/dashboard/licenses` | 307 | 76 | 76 | redirect to /auth/sign-in |
| `/dashboard/marketing-overview` | 307 | 60 | 60 | redirect to /auth/sign-in |
| `/dashboard/master` | 307 | 58 | 58 | redirect to /auth/sign-in |
| `/dashboard/master/categories` | 307 | 83 | 83 | redirect to /auth/sign-in |
| `/dashboard/master/curricula` | 307 | 101 | 101 | redirect to /auth/sign-in |
| `/dashboard/master/grade-levels` | 307 | 62 | 62 | redirect to /auth/sign-in |
| `/dashboard/master/landing-banners` | 307 | 61 | 62 | redirect to /auth/sign-in |
| `/dashboard/master/legal-documents` | 307 | 55 | 56 | redirect to /auth/sign-in |
| `/dashboard/master/media-review-rules` | 307 | 56 | 57 | redirect to /auth/sign-in |
| `/dashboard/master/media-types` | 307 | 56 | 56 | redirect to /auth/sign-in |
| `/dashboard/master/order-finance-types` | 307 | 58 | 58 | redirect to /auth/sign-in |
| `/dashboard/master/popup-announcements` | 307 | 59 | 59 | redirect to /auth/sign-in |
| `/dashboard/master/report-reasons` | 307 | 61 | 61 | redirect to /auth/sign-in |
| `/dashboard/master/sale-types` | 307 | 63 | 63 | redirect to /auth/sign-in |
| `/dashboard/master/tags` | 307 | 52 | 52 | redirect to /auth/sign-in |
| `/dashboard/my-apps` | 307 | 60 | 60 | redirect to /auth/sign-in |
| `/dashboard/payment-reviews` | 307 | 62 | 62 | redirect to /auth/sign-in |
| `/dashboard/payment/[id]` | skipped | - | - | dynamic route requires valid fixture |
| `/dashboard/payouts` | 307 | 228 | 229 | redirect to /auth/sign-in |
| `/dashboard/product-approvals` | 307 | 56 | 56 | redirect to /auth/sign-in |
| `/dashboard/products` | 307 | 65 | 65 | redirect to /auth/sign-in |
| `/dashboard/purchases` | 307 | 58 | 58 | redirect to /auth/sign-in |
| `/dashboard/purchases/[id]` | skipped | - | - | dynamic route requires valid fixture |
| `/dashboard/receipts` | 307 | 130 | 130 | redirect to /auth/sign-in |
| `/dashboard/referrals` | 307 | 133 | 133 | redirect to /auth/sign-in |
| `/dashboard/school-entitlements` | 307 | 102 | 102 | redirect to /auth/sign-in |
| `/dashboard/seller` | 307 | 59 | 59 | redirect to /auth/sign-in |
| `/dashboard/seller-accounts` | 307 | 55 | 55 | redirect to /auth/sign-in |
| `/dashboard/seller-accounts/[id]` | skipped | - | - | dynamic route requires valid fixture |
| `/dashboard/seller-approvals` | 307 | 54 | 54 | redirect to /auth/sign-in |
| `/dashboard/seller-approvals/[id]` | skipped | - | - | dynamic route requires valid fixture |
| `/dashboard/seller/analytics` | 307 | 51 | 51 | redirect to /auth/sign-in |
| `/dashboard/seller/deals` | 307 | 62 | 62 | redirect to /auth/sign-in |
| `/dashboard/seller/finance` | 307 | 56 | 57 | redirect to /auth/sign-in |
| `/dashboard/seller/products/[id]/edit` | skipped | - | - | dynamic route requires valid fixture |
| `/dashboard/seller/products/new` | 307 | 63 | 63 | redirect to /auth/sign-in |
| `/dashboard/seller/profile` | 307 | 56 | 56 | redirect to /auth/sign-in |
| `/dashboard/seller/profile/edit` | 307 | 113 | 113 | redirect to /auth/sign-in |
| `/dashboard/seller/settings/line` | 307 | 56 | 56 | redirect to /auth/sign-in |
| `/dashboard/seller/settings/line/guide` | 307 | 183 | 183 | redirect to /auth/sign-in |
| `/dashboard/seller/setup` | 307 | 55 | 55 | redirect to /auth/sign-in |
| `/dashboard/seller/shipping` | 307 | 61 | 61 | redirect to /auth/sign-in |
| `/dashboard/settings/finance` | 307 | 105 | 106 | redirect to /auth/sign-in |
| `/dashboard/settings/line` | 307 | 55 | 55 | redirect to /auth/sign-in |
| `/dashboard/settings/platform` | 307 | 150 | 150 | redirect to /auth/sign-in |
| `/dashboard/settings/referrals` | 307 | 60 | 60 | redirect to /auth/sign-in |
| `/dashboard/settings/security-audit` | 307 | 55 | 55 | redirect to /auth/sign-in |
| `/dashboard/settings/seller-badges` | 307 | 53 | 54 | redirect to /auth/sign-in |
| `/dashboard/settings/shipping` | 307 | 57 | 57 | redirect to /auth/sign-in |
| `/dashboard/settings/storage` | 307 | 56 | 56 | redirect to /auth/sign-in |
| `/dashboard/settings/system-audit` | 307 | 54 | 54 | redirect to /auth/sign-in |
| `/dashboard/settings/system-users` | 307 | 53 | 53 | redirect to /auth/sign-in |
| `/dashboard/store/[slug]` | skipped | - | - | dynamic route requires valid fixture |
| `/invitations/accept` | 200 | 346 | 354 | HTTP only; client JS not executed |
| `/legal` | 200 | 167 | 229 | HTTP only; client JS not executed |
| `/legal/[slug]` | skipped | - | - | dynamic route requires valid fixture |
| `/official-products` | 200 | 163 | 237 | HTTP only; client JS not executed |
| `/privacy-policy` | 200 | 164 | 179 | HTTP only; client JS not executed |
| `/product/[id]` | skipped | - | - | dynamic route requires valid fixture |
| `/products` | 200 | 174 | 191 | HTTP only; client JS not executed |
| `/quotes/[token]` | skipped | - | - | dynamic route requires valid fixture |
| `/refund-policy` | 200 | 158 | 161 | HTTP only; client JS not executed |
| `/school/setup/[token]` | skipped | - | - | dynamic route requires valid fixture |
| `/seller-agreement` | 200 | 140 | 320 | HTTP only; client JS not executed |
| `/service-agreement` | 200 | 184 | 187 | HTTP only; client JS not executed |
| `/settings` | 200 | 113 | 122 | HTTP only; client JS not executed |
| `/store/[slug]` | skipped | - | - | dynamic route requires valid fixture |
| `/stores` | 200 | 277 | 305 | HTTP only; client JS not executed |
| `/terms-of-service` | 200 | 254 | 257 | HTTP only; client JS not executed |

## Public API and valid storefront samples

One production GET per endpoint, no authentication or query analytics.

| Endpoint | HTTP | Headers ms | Total ms |
| --- | --- | ---: | ---: |
| `/api/marketplace/contact` | 200 | 256 | 258 |
| `/api/marketplace/public-stats` | 200 | 168 | 170 |
| `/api/marketplace/stores?page=1&limit=24` | 200 | 209 | 210 |
| `/api/marketplace/categories` | 200 | 138 | 138 |
| `/api/marketplace/products?cards=1&limit=12` | 200 | 295 | 296 |
| `/api/marketplace/media-types` | 200 | 116 | 117 |
| `/api/marketplace/products?official=1&cards=1&limit=12` | 200 | 315 | 315 |
| `/api/marketplace/sale-types` | 200 | 141 | 142 |
| `/store/kindera` | 200 | 154 | 162 |

## Local checks after changes

- Security suite: 200 passed, 0 failed (including cache isolation, invalidation, auth, purchase loading, image access and notification counts).
- Full src ESLint: passed.
- TypeScript --noEmit --incremental false: passed.
- git diff --check: passed.
- Existing purchases-loading VM fixture now supplies the standard performance global used by Server-Timing instrumentation.
- No deployment, commit, production schema changes or authenticated browser E2E performed.
