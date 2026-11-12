# Frontend API cache

Browser requests flow through `apiFetch` → TanStack Query → API route → backend → database.
All existing browser `fetch` call sites explicitly import `apiFetch as fetch` from
`src/lib/api-fetch`. Native `window.fetch` is not patched. Server-side API routes
and service integrations continue to use native fetch.

## Rules

- Successful same-origin JSON GET responses share an in-memory cache and in-flight
  requests. Keys include the authenticated identity, request URL, query parameters,
  headers and credentials mode.
- Ordinary reads stay fresh for 30 seconds. Categories, curricula, grade levels,
  media/sale types, tags and legal documents stay fresh for 5 minutes.
- Payment, order, finance, payout, access, entitlement, notification and LINE quota
  reads have zero stale time. They may share concurrent requests, but sequential
  calls always revalidate with the API.
- Authentication, bearer/secret-bearing requests, external services and file or
  non-JSON responses are not reused from this cache.
- Successful POST/PUT/PATCH/DELETE requests invalidate read caches and refetch active
  query observers. Failed writes do not invalidate. Preview and view-tracking
  requests do not flush unrelated page data.
- Login, logout or identity/role changes clear caches before the new identity is
  committed. The provider shares a singleton only in the browser; server renders
  receive independent clients. No private cache is persisted to localStorage.
- One consumer's AbortSignal does not cancel another consumer's shared request.
- `cache: 'no-store'` still controls the HTTP cache, while TanStack freshness follows
  the rules above. Use `cache: 'reload'` or `cache: 'no-cache'` to force an explicit
  fresh read before the normal TTL expires.

## New code

Use `useQuery` / `useInfiniteQuery` for reactive screens and import `apiFetch` for
network calls, including writes. Existing API action functions already use this
gateway and can be used as query/mutation functions. Keep keys scoped by user and
all relevant filters. Avoid calling the same query key recursively inside its own
query function; transport keys are reserved under `api-response`.

The `client-api-cache-coverage` test detects browser fetch calls that bypass the
gateway. Cache tests cover deduplication, invalidation, cancellation, authentication,
variants, error responses, live endpoints and server-rendering isolation.

Caching reduces repeated frontend requests. It does not replace indexes, bounded
queries, database aggregation or backend performance work for first-time loads.
