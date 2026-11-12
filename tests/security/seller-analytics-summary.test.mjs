import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

test('dashboard analytics returns only overview data while full analytics retains daily series', async () => {
  const limits = [];
  const analytics = { summary: { orders: 7, netRevenue: 90 }, products: Array.from({ length: 8 }, (_, i) => ({ product_id: String(i) })), daily: [{ date: 'today' }], searchTerms: [{ term: 'private' }] };
  const exports = {};
  const mocks = {
    'next/server': { NextResponse: { json: body => ({ body }) } },
    'src/lib/auth-token': { requireAuthenticated: () => ({ sub: 'owner' }) },
    'src/lib/supabase-admin': { supabaseAdmin: {
      from: table => {
        const q = { select: () => q, eq: () => q, order: () => q,
          maybeSingle: async () => ({ data: { id: 'seller' } }),
          limit: async n => { limits.push(n); return { data: [] }; } };
        return q;
      },
      rpc: async (_, args) => { assert.equal(args.target_seller_id, 'seller'); return { data: analytics }; },
    } },
  };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/app/api/marketplace/seller/analytics/route.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, URL, require: name => mocks[name] });
  const summary = (await exports.GET({ url: 'https://example.test/analytics?days=30&summary=1' })).body;
  assert.equal(summary.analytics.summary.orders, 7);
  assert.equal(summary.analytics.products.length, 3);
  assert.equal(summary.analytics.daily, undefined);
  assert.equal(summary.analytics.searchTerms, undefined);
  const full = (await exports.GET({ url: 'https://example.test/analytics?days=30' })).body;
  assert.equal(full.analytics.products.length, 8);
  assert.equal(full.analytics.daily.length, 1);
  assert.deepEqual(limits, [3, 5]);
});
