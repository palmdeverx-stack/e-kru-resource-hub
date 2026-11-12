import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function route(file, { role = 'marketplace_user', summary = true } = {}) {
  const calls = [];
  const query = { select: columns => { calls.push(columns); return query; }, eq: () => query,
    maybeSingle: async () => ({ data: summary ? { id: 'seller', status: 'active', document_count: [{ count: 2 }], payout_count: { count: 1 } } : { allow_seller_notifications: true } }),
  };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/auth-token': { requireAuthenticated: () => role ? { sub: 'owner', role } : null },
    'src/lib/supabase-admin': { supabaseAdmin: { from: () => query } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, URL, require: name => mocks[name] ?? {} });
  return { ...exports, calls };
}

test('dashboard seller summary uses one query with counts instead of private relations', async () => {
  const api = route('src/app/api/marketplace/seller/route.ts');
  const response = await api.GET({ url: 'https://example.test/seller?summary=1' });
  assert.equal(response.status, 200);
  assert.equal(response.body.seller.has_documents, true);
  assert.equal(response.body.seller.has_payout_account, true);
  assert.equal(response.body.seller.document_count, undefined);
  assert.equal(response.body.seller.payout_account, undefined);
  assert.equal(api.calls.length, 1);
  assert.ok(!api.calls[0].includes('*'));
  assert.ok(!api.calls[0].includes('encrypted'));
});
test('LINE menu access reads only the platform toggle, without package synchronization', async () => {
  const api = route('src/app/api/marketplace/seller/line-settings/route.ts', { summary: false });
  const response = await api.GET({ url: 'https://example.test/line-settings?access=menu' });
  assert.equal(response.status, 200);
  assert.equal(response.body.allowed, true);
  assert.equal(api.calls.join(','), 'allow_seller_notifications');
});
test('seller summaries still reject unauthenticated callers', async () => {
  const api = route('src/app/api/marketplace/seller/route.ts', { role: null });
  assert.equal((await api.GET({})).status, 401);
  assert.equal(api.calls.length, 0);
});
