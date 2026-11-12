import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

test('admin overview preserves financial totals and order counts without sorting the aggregate input', async () => {
  const exports = {};
  const calls = [];
  const orders = [
    { total: 100, platform_fee: 10, seller_net: 85, status: 'paid' },
    { total: 200, platform_fee: 20, seller_net: 170, status: 'completed' },
    { total: 50, platform_fee: 5, seller_net: 40, status: 'payment_review' },
    { total: 70, platform_fee: 7, seller_net: 60, status: 'refunded' },
  ];
  const mocks = {
    'next/server': { NextResponse: { json: body => ({ body }) } },
    'src/lib/auth-token': { requireRole: () => ({ sub: 'admin' }) },
    'src/lib/supabase-admin': { supabaseAdmin: { from: table => {
      const call = { table, sorted: false }; calls.push(call);
      const q = { select: columns => { call.columns = columns; return q; }, eq: () => q, neq: () => q, in: () => q,
        order: () => { call.sorted = true; return q; }, limit: () => q,
        then: resolve => Promise.resolve({ data: table === 'marketplace_orders' ? orders : [], count: 2 }).then(resolve) };
      return q;
    } } },
  };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/app/api/marketplace/admin/overview/route.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => mocks[name] });
  const { body } = await exports.GET({});
  assert.equal(body.metrics.grossSales, 300);
  assert.equal(body.metrics.platformRevenue, 30);
  assert.equal(body.metrics.sellerRevenue, 255);
  assert.equal(body.metrics.orderCount, 4);
  assert.equal(body.attention.pendingOrderCount, 1);
  const aggregate = calls.find(x => x.table === 'marketplace_orders' && !x.columns.includes('id,'));
  assert.equal(aggregate.sorted, false);
  assert.equal(aggregate.columns, 'total, platform_fee, seller_net, status');
});
