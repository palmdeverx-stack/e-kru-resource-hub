import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const id = '11111111-1111-1111-1111-111111111111';
function loadRoute(file, database, authorized = true) {
  const exports = {};
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/auth-token': { requireRole: () => authorized },
    'src/lib/supabase-admin': { supabaseAdmin: database },
    'src/sections/marketplace/admin/server/finance': { DEFAULT_FINANCE_SETTINGS: { commission_rate: 10 } },
  };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../../src/app/api/marketplace/admin/seller-accounts/${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, URL, require: name => { assert.ok(mocks[name], name); return mocks[name]; } });
  return exports;
}

test('listing can return rows without waiting for aggregate statistics', async () => {
  const route = loadRoute('route.ts', {
    from: table => {
      const query = {
        select: columns => {
          if (table === 'marketplace_finance_settings') assert.equal(columns, 'commission_rate');
          return query;
        },
        neq: () => query, eq: () => query, order: () => query,
        range: async () => ({ data: [{ id, wizard_step: 2, draft_wizard_step: '4' }], count: 1 }),
        maybeSingle: async () => ({ data: { commission_rate: 12 } }),
      };
      return query;
    },
    rpc: () => assert.fail('list must not wait for statistics'),
  });
  const result = await route.GET({ url: 'https://example.test/api?includeStats=false&page=1&pageSize=10' });
  assert.equal(result.status, 200);
  assert.equal(result.body.sellers[0].id, id);
  assert.equal(result.body.sellers[0].wizard_step, 4);
  assert.equal(result.body.sellers[0].draft_wizard_step, undefined);
  assert.equal(result.body.defaultCommissionRate, 12);
  assert.equal(result.body.pagination.total, 1);
});

test('statistics endpoint requires admin access and bounded valid IDs', async () => {
  const database = { rpc: () => assert.fail('invalid request must not query stats') };
  assert.equal((await loadRoute('stats/route.ts', database, false).GET({})).status, 403);
  const route = loadRoute('stats/route.ts', database);
  for (const query of ['', '?ids=invalid', `?ids=${Array.from({ length: 51 }, (_, i) => `${i.toString(16).padStart(8, '0')}-1111-1111-1111-111111111111`).join(',')}`]) {
    assert.equal((await route.GET({ url: `https://example.test/api${query}` })).status, 400);
  }
});

test('statistics load independently and propagate database failures', async () => {
  let calls = 0;
  const route = loadRoute('stats/route.ts', {
    rpc: async (name, args) => {
      calls++;
      assert.equal(name, 'marketplace_seller_account_stats');
      assert.equal(args.seller_ids.length, 1);
      assert.equal(args.seller_ids[0], id);
      return { data: [{ seller_id: id, sold_count: 5 }] };
    },
  });
  const result = await route.GET({ url: `https://example.test/api?ids=${id},${id}` });
  assert.equal(calls, 1);
  assert.equal(result.body.stats[0].sold_count, 5);
  const failure = loadRoute('stats/route.ts', { rpc: async () => ({ error: { message: 'unavailable' } }) });
  assert.equal((await failure.GET({ url: `https://example.test/api?ids=${id}` })).status, 500);
});
