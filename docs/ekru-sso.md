# Marketplace → E-KRU SSO

Marketplace issuer endpoints are implemented here. E-KRU receiver routes must be implemented in the e-kru.com repository before enabling the button. This is a private identity handoff protocol, not a general OAuth/OIDC provider.

## Configuration

Marketplace server:

```env
MARKETPLACE_SSO_SECRET=<at-least-32-random-characters>
EKRU_SSO_CALLBACK_URL=https://e-kru.com/auth/marketplace/callback
NEXT_PUBLIC_EKRU_URL=https://e-kru.com
# Enable ONLY after E-KRU implements the receiver below. Rebuild after changing.
NEXT_PUBLIC_EKRU_SSO_ENABLED=false
```

Store the same secret in the E-KRU server environment. Never use a NEXT_PUBLIC variable for this secret. Apply `202610260003_marketplace_sso_codes.sql`. Do not share the application JWT signing secret. Periodically delete expired rows from `marketplace_sso_codes`; only code hashes are stored.

## Required E-KRU receiver

1. `GET /auth/marketplace/start?returnTo=/teacher/`: validate returnTo as a local path (reject `//`, backslashes, and foreign URLs). Generate random state (32+ base64url characters) and verifier (43–128 RFC7636 characters). Store state, verifier and returnTo in a short-lived server session or authenticated/encrypted HttpOnly Secure SameSite=Lax cookie. Support at most five minutes. Never accept a callback without this browser-bound transaction.
2. Redirect the browser to `https://e-kru-marketplace.com/api/sso/authorize` with:
   - `state`: generated state
   - `code_challenge`: base64url(SHA256(verifier))
   - `code_challenge_method=S256`
   - `redirect_uri=https://e-kru.com/auth/marketplace/callback` (exact match)
3. Marketplace validates its current session/account and redirects to the fixed callback with `code` and `state`. The code expires after 60 seconds.
4. `GET /auth/marketplace/callback`: validate state against the initiating browser transaction using a constant-time comparison, enforce expiry, then consume/delete that transaction. Send a **server-side** POST to `https://e-kru-marketplace.com/api/sso/exchange`:

   ```http
   Authorization: Bearer <MARKETPLACE_SSO_SECRET>
   Content-Type: application/json
   ```

   ```json
   {
     "code": "code-from-callback",
     "code_verifier": "verifier-from-browser-transaction",
     "redirect_uri": "https://e-kru.com/auth/marketplace/callback"
   }
   ```

5. Verify successful status and the fixed expected `issuer`. Response provides `subject` (namespaced by account table), `account_type`, `user_id`, `auth_user_id` (nullable), first_name and last_name. Codes are atomically deleted when exchanged and cannot be reused, including parallel exchanges. Marketplace rechecks account/session revocation on exchange.
6. Resolve E-KRU identity using a unique mapping `(expected issuer, subject)`, or a trusted shared Supabase Auth ID when both apps use the same Auth project. Never match by name, unverified email or arbitrary user ID alone. A Marketplace member is **not automatically a school teacher or admin**. For new LINE-only users with null auth_user_id, explicitly provision an isolated personal workspace according to E-KRU policy, or present account linking/onboarding. Never grant a school role from the requested destination.
7. Load E-KRU's own account activity, school membership, PIN requirements, subscription and purchased entitlements. Fail closed on disabled accounts or missing permissions. Create E-KRU's own HttpOnly session, then redirect to the previously validated returnTo.

Callback pages must use `Cache-Control: no-store` and `Referrer-Policy: no-referrer`, avoid analytics/third-party resources and remove the code from the address bar immediately by redirecting. Redact callback query strings and exchange request bodies in infrastructure logs. Do not return a Marketplace JWT to the browser or accept client-supplied identity claims.

## Verification before enabling

Test both existing and LINE-only members, no Marketplace session, cancelled/expired callbacks, wrong state, wrong client secret, wrong callback URL, wrong verifier, parallel/replayed code exchange, revoked session/suspended account, and E-KRU role/entitlement enforcement. The local unit tests do not replace receiver/database integration testing.

Security reference: https://www.rfc-editor.org/rfc/rfc9700.html
