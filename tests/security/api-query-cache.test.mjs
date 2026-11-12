import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { QueryClient, QueryObserver, timeoutManager } from '@tanstack/react-query';

// Cache eviction timers must not keep the Node test worker alive.
timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => { const timer = setTimeout(callback, delay); timer.unref(); return timer; },
  clearTimeout: timer => clearTimeout(timer),
  setInterval: (callback, delay) => { const timer = setInterval(callback, delay); timer.unref(); return timer; },
  clearInterval: timer => clearInterval(timer),
});

function gateway(t, nativeFetch, { browser = true } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  t.after(() => client.clear());
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/lib/api-fetch.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, Request, Response, Headers, DOMException, fetch: nativeFetch,
    ...(browser ? { window: { location: { origin: 'https://app.test' } } } : {}),
    require: name => { assert.equal(name, './query-client'); return { getQueryClient: () => client }; },
  });
  exports.setApiCacheScope('user-a');
  return { ...exports, client };
}
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

test('JSON reads reuse one TanStack cache entry across consumers and parameter order', async t => {
  let calls = 0;
  const api = gateway(t, async () => { calls++; return json({ value: calls }); });
  const first = await api.apiFetch('/api/products?b=2&a=1', { cache: 'no-store' });
  const second = await api.apiFetch('/api/products?a=1&b=2');
  assert.deepEqual(await first.json(), { value: 1 });
  assert.deepEqual(await second.json(), { value: 1 });
  assert.equal(calls, 1);
  assert.equal(api.client.getQueryCache().getAll().length, 1);
});

test('simultaneous reads share a request, but cancelling one consumer leaves the other running', async t => {
  let complete;
  let calls = 0;
  const api = gateway(t, () => { calls++; return new Promise(resolve => { complete = resolve; }); });
  const controller = new AbortController();
  const first = api.apiFetch('/api/products', { signal: controller.signal });
  const second = api.apiFetch('/api/products');
  const rejected = assert.rejects(first, { name: 'AbortError' });
  controller.abort();
  complete(json({ ok: true }));
  await rejected;
  assert.deepEqual(await (await second).json(), { ok: true });
  assert.equal(calls, 1);
});

test('successful writes invalidate cached reads; failed writes retain them; POST is never cached', async t => {
  let reads = 0;
  let writes = 0;
  let fail = false;
  const api = gateway(t, async (_, options) => {
    if (options?.method === 'POST') { writes++; return new Response(null, { status: fail ? 400 : 204 }); }
    return json({ version: ++reads });
  });
  await api.apiFetch('/api/products');
  fail = true;
  await api.apiFetch('/api/products', { method: 'POST' });
  assert.equal((await (await api.apiFetch('/api/products')).json()).version, 1);
  fail = false;
  await api.apiFetch('/api/products', { method: 'POST' });
  assert.equal((await (await api.apiFetch('/api/products')).json()).version, 2);
  await api.apiFetch('/api/products', { method: 'POST' });
  assert.equal(writes, 3);
});

test('switching identity clears transport and hook caches and cancels previous-session reads', async t => {
  let resolveOld;
  const api = gateway(t, () => new Promise(resolve => { resolveOld = resolve; }));
  api.client.setQueryData(['hook-data'], { private: true });
  const pending = api.apiFetch('/api/profile');
  const rejected = assert.rejects(pending);
  api.setApiCacheScope('user-b');
  resolveOld(json({ private: 'old-user' }));
  await rejected;
  assert.equal(api.client.getQueryData(['hook-data']), undefined);
  assert.equal(api.client.getQueryCache().getAll().length, 0);
});

test('auth, live finance, bearer credentials, one-time tokens, reloads and external requests read fresh', async t => {
  let calls = 0;
  const api = gateway(t, async () => { calls++; return json({ ok: true }); });
  for (const [url, options] of [
    ['/api/auth/me', undefined], ['/api/marketplace/seller/finance?summary=1', undefined],
    ['/api/profile', { headers: { Authorization: 'Bearer sensitive' } }],
    ['/api/invite?token=sensitive', undefined], ['/api/products', { cache: 'reload' }],
    ['https://outside.test/api/products', undefined],
  ]) {
    const before = calls;
    await api.apiFetch(url, options);
    await api.apiFetch(url, options);
    assert.equal(calls - before, 2, url);
  }
});

test('failed and non-JSON responses preserve fetch semantics without caching results', async t => {
  let calls = 0;
  const api = gateway(t, async () => { calls++; return new Response('rejected', { status: 403 }); });
  for (let index = 0; index < 2; index++) {
    const response = await api.apiFetch('/api/products');
    assert.equal(response.status, 403);
    assert.equal(await response.text(), 'rejected');
  }
  assert.equal(calls, 2);
});

test('request headers and credential mode separate cached variants', async t => {
  let calls = 0;
  const api = gateway(t, async () => json({ version: ++calls }));
  for (const options of [{ headers: { 'Accept-Language': 'th' } }, { headers: { 'Accept-Language': 'en' } }, { credentials: 'omit' }]) {
    await api.apiFetch('/api/products', options);
    await api.apiFetch('/api/products', options);
  }
  assert.equal(calls, 3);
});

test('server rendering passes through without sharing a browser cache', async t => {
  let calls = 0;
  const api = gateway(t, async () => { calls++; return json({}); }, { browser: false });
  await api.apiFetch('https://app.test/api/products');
  await api.apiFetch('https://app.test/api/products');
  assert.equal(calls, 2);
  assert.equal(api.client.getQueryCache().getAll().length, 0);
});

test('preview and view-tracking POSTs do not flush unrelated page caches', async t => {
  let reads = 0;
  const api = gateway(t, async (_, options) => options?.method === 'POST' ? json({ ok: true }) : json({ version: ++reads }));
  await api.apiFetch('/api/products');
  await api.apiFetch('/api/documents?preview=1', { method: 'POST' });
  await api.apiFetch('/api/products/one/view', { method: 'POST' });
  assert.equal((await (await api.apiFetch('/api/products')).json()).version, 1);
});


test('a mutation during the first screen load cancels stale work and refetches the active observer', async t => {
  let reads = 0;
  let completeOld;
  const api = gateway(t, (_, options) => {
    if (options?.method === 'POST') return Promise.resolve(new Response(null, { status: 204 }));
    reads++;
    return reads === 1 ? new Promise(resolve => { completeOld = resolve; }) : Promise.resolve(json({ version: 2 }));
  });
  const observer = new QueryObserver(api.client, { queryKey: ['screen'], queryFn: async () => (await api.apiFetch('/api/products')).json() });
  const unsubscribe = observer.subscribe(() => {});
  t.after(unsubscribe);
  await api.apiFetch('/api/products', { method: 'POST' });
  completeOld(json({ version: 1 }));
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(observer.getCurrentResult().data.version, 2);
});
