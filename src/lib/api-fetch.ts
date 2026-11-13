import { getQueryClient } from './query-client';

const API_QUERY_KEY = 'api-response';
let sessionScope: string | undefined;
let epoch = 0;

type CachedResponse = {
  body: string;
  status: number;
  statusText: string;
  headers: [string, string][];
};
class UncachedResponse extends Error {
  constructor(public response: Response) {
    super('Response is not cacheable');
  }
}

/** Called before committing a new auth identity; private caches never cross sessions. */
export function setApiCacheScope(scope: string) {
  if (sessionScope === scope) return;
  const previousScope = sessionScope;
  sessionScope = scope;
  epoch += 1;
  if (previousScope !== undefined && typeof window !== 'undefined') getQueryClient().clear();
}

/** Explicit refresh is also available to screens that need data before its TTL. */
export function invalidateApiCache() {
  epoch += 1;
  if (typeof window === 'undefined') return;
  const client = getQueryClient();
  const screens = {
    predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== API_QUERY_KEY,
  };
  const cancelled = client.cancelQueries(screens);
  client.removeQueries({ queryKey: [API_QUERY_KEY] });
  void cancelled.then(() => client.invalidateQueries(screens));
}

export function apiCacheStaleTime(url: URL) {
  // Never reuse a stale session, payment/access decision, quota, token, or download link.
  if (
    /\/(?:auth|access-permissions|payment|payments|orders|finance|finance-settings|payouts|payout-access|stripe-payout-summary|downloads|receipts|licenses|entitlements|school-entitlements|user-entitlements|subscription|subscriptions|line-settings|line-link|line-notifications|notifications|security-audit)(?:\/|$)/.test(
      url.pathname
    )
  )
    return 0;
  if (
    url.searchParams.has('edit') ||
    /\/(?:reminder|invite|invitations|storage)(?:\/|$)/.test(url.pathname)
  )
    return 0;
  if (
    /\/(?:categories|curricula|grade-levels|media-types|sale-types|tags|legal-documents)(?:\/|$)/.test(
      url.pathname
    )
  )
    return 5 * 60_000;
  return 30_000;
}

function waitForConsumer<T>(promise: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted)
    return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

/**
 * Same-origin browser API gateway. Keeps native fetch/Response semantics for all
 * callers; successful JSON GETs are cached by session, URL and headers. Writes
 * always reach the server and invalidate reads only after a successful response.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof window === 'undefined') return fetch(input, init);
  const requestInput = input instanceof Request ? input : null;
  const url = new URL(requestInput?.url ?? String(input), window.location.origin);
  const method = (init?.method ?? requestInput?.method ?? 'GET').toUpperCase();
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/'))
    return fetch(input, init);
  // Authentication and one-time credentials must not be intercepted or replayed.
  const headers = new Headers(init?.headers ?? requestInput?.headers);
  const sensitiveHeaders = [...headers.keys()].some((key) =>
    /authorization|cookie|token|secret/i.test(key)
  );
  const sensitiveParams = [...url.searchParams.keys()].some((key) =>
    /token|secret|signature|password|code/i.test(key)
  );
  if (url.pathname.startsWith('/api/auth/')) return fetch(input, init);

  if (method !== 'GET') {
    const response = await fetch(input, init);
    // Read receipts affect notification queries only. The menu invalidates its own
    // observer; unrelated purchase, finance and form queries must keep running.
    const isNotificationReceipt = url.pathname.replace(/\/$/, '') === '/api/notifications/mark-read';
    if (response.ok && isNotificationReceipt) {
      getQueryClient().removeQueries({
        predicate: (query) => query.queryKey[0] === API_QUERY_KEY &&
          typeof query.queryKey[3] === 'string' &&
          new URL(query.queryKey[3]).pathname.replace(/\/$/, '') === '/api/notifications',
      });
      return response;
    }
    const isPreview = url.searchParams.get('preview') === '1';
    const isTelemetry = /\/(?:view|views|track|tracking|click|consent)$/.test(url.pathname);
    if (response.ok && method !== 'HEAD' && method !== 'OPTIONS' && !isPreview && !isTelemetry)
      invalidateApiCache();
    return response;
  }
  if (sessionScope === undefined || sensitiveHeaders || sensitiveParams) return fetch(input, init);
  const consumerSignal = init?.signal ?? requestInput?.signal;
  if (consumerSignal?.aborted)
    throw consumerSignal.reason ?? new DOMException('Aborted', 'AbortError');
  url.searchParams.sort();
  const credentialMode = init?.credentials ?? requestInput?.credentials ?? 'same-origin';
  const cacheMode = init?.cache ?? requestInput?.cache;
  const staleTime = cacheMode === 'reload' || cacheMode === 'no-cache' ? 0 : apiCacheStaleTime(url);
  const client = getQueryClient();
  const promise = client
    .fetchQuery<CachedResponse>({
      queryKey: [
        API_QUERY_KEY,
        sessionScope,
        epoch,
        url.href,
        credentialMode,
        [...headers.entries()].sort(),
      ],
      staleTime,
      gcTime: 5 * 60_000,
      retry: false,
      queryFn: async ({ signal }) => {
        // Cancelling one consumer must not cancel a request shared by other screens.
        const response = await fetch(input, { ...init, signal });
        if (
          !response.ok ||
          response.redirected ||
          !response.headers.get('content-type')?.includes('application/json')
        ) {
          throw new UncachedResponse(response);
        }
        return {
          body: await response.text(),
          status: response.status,
          statusText: response.statusText,
          headers: [...response.headers.entries()],
        };
      },
    })
    .then(
      (data) =>
        new Response(data.body, {
          status: data.status,
          statusText: data.statusText,
          headers: data.headers,
        }),
      (error: unknown) => {
        if (error instanceof UncachedResponse) return error.response.clone();
        throw error;
      }
    );
  return waitForConsumer(promise, consumerSignal);
}
