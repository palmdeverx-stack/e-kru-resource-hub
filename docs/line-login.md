# LINE Login / LIFF

This integration supports signing up with LINE and connecting an existing active Marketplace member. It never merges accounts based on LINE email or display name. School and administrator accounts are not supported.

## Setup

1. Apply `supabase/migrations/202610260001_marketplace_line_identities.sql`, then `supabase/migrations/202610260002_marketplace_line_signup.sql` to your Supabase project.
2. Set these variables in local and hosting environments, then rebuild:

   ```env
   NEXT_PUBLIC_LIFF_ID=your-liff-id
   LINE_LOGIN_CHANNEL_ID=your-line-login-channel-id
   ```

3. In LINE Developers, configure the LIFF app endpoint as `https://e-kru-marketplace.com/auth/line` and enable `openid` and `profile` scopes. The channel ID must belong to the channel hosting this LIFF app, not the Messaging API channel used for notifications.
4. Open `/auth/line` or the LINE button on the sign-in page. For first-time linking, sign in to E-KRU, return to `/auth/line`, and explicitly confirm the account link. New users can enter their first/last name and accept the terms on the LINE callback page to create a LINE-only member directly.
5. Sign out of E-KRU and open the LIFF URL in LINE. Confirm that the same Marketplace account is restored automatically.
6. Test suspended/inactive accounts, a LINE identity already linked to another account, and purchasing/subscription flows in the LINE browser before release.

The server verifies the raw ID token with LINE before issuing the existing HttpOnly session cookie. Unique constraints prevent duplicate or overwritten account links. The identity table is restricted to the service role. No LINE tokens are stored or logged.

Reference: https://developers.line.biz/en/docs/liff/using-user-profile/

MINI App submission/review and LINE Developers configuration are external steps; this code does not submit a MINI App for review.

## Troubleshooting: LINE 400 invalid url

`liff.login()` requires its redirect URL to be the configured LIFF Endpoint URL or a URL below that path. Query parameters such as `returnTo=%2F` are allowed; they are not the cause of this error.

For example, a LIFF app configured with `https://e-kru-marketplace.com/auth/line` cannot log in from `http://localhost:8800/auth/line`. Setting only the LINE Login callback URL does not change the LIFF Endpoint URL.

- Production: open `https://e-kru-marketplace.com/auth/line` and configure that exact endpoint in LINE Developers → your channel → LIFF → your app.
- Local development: expose port 8800 using an HTTPS tunnel (for example, `ngrok http 8800`). Create a separate development LIFF app, set its Endpoint URL to `https://YOUR-TUNNEL-HOST/auth/line`, and set `NEXT_PUBLIC_LIFF_ID` to that development app's ID. Set `LINE_LOGIN_CHANNEL_ID` to the channel hosting it. Restart Next.js and open the HTTPS tunnel URL, including for E-KRU sign-in and linking.
- If the tunnel hostname changes, update the development LIFF Endpoint URL before testing again.

Keep the complete sign-in/link flow on the same origin so the E-KRU session cookie remains available. Do not redirect local linking to the production host to bypass this error.

Reference: https://developers.line.biz/en/reference/liff/#login

## LINE is logged in but the website still shows Sign in

LINE identity and the E-KRU session are separate. `/auth/line` now automatically submits a logged-in LINE identity to `/api/auth/line`, then verifies `/api/auth/me` before returning to the website. Existing members can sign in to E-KRU and explicitly link their account. New members can use the LINE signup form.

For older MINI App configurations that use `/` as the endpoint, the home layout initializes LIFF on detected LINE entries before forwarding to `/auth/line`. Prefer `/auth/line` as the endpoint for reliable entry in external browsers too.

After deployment, check that `POST /api/auth/line` succeeds and sets the HttpOnly `access_token` cookie, followed by `GET /api/auth/me` returning 200. A 409 with `needsRegistration` means the LINE identity has no E-KRU account yet; the callback displays signup and existing-account linking options. Session responses now explicitly disable caching.

The LINE sign-in button now starts authorization automatically through `/auth/line`. This route is a processing/callback screen; users do not need to press Continue. Only first-time account linking requires explicit confirmation.

## No ID token

The client prefers `liff.getIDToken()`. When it is absent, it sends `liff.getAccessToken()` instead. The server verifies the access token with LINE, requires the configured channel ID and a positive expiry, then retrieves `/v2/profile` from LINE. No client-supplied profile is trusted. This fallback requires `profile` permission. For ID-token authentication, enable `openid` for the selected LIFF app and obtain a fresh LINE session after changing permissions.

## LINE signup

New users provide first/last name and explicitly accept the linked terms/privacy policy. The API verifies LINE identity again on registration. A service-role-only Postgres function locks the LINE identity, creates the member and identity link in one transaction, and returns an existing member on repeated requests. Registration is rate-limited. Existing linked members retain suspension checks.

LINE-only members have no password, Supabase Auth ID or email until a separate verified email/account setup flow is added. They sign in through LINE. The migration permits null email/auth IDs and records `accepted_legal_at`. No placeholder email is created and no existing account is merged. Email delivery is unavailable for these members; test checkout and receipt behavior before production release.
