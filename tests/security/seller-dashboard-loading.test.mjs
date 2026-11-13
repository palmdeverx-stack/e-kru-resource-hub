import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function financeRoute({ authorized = true, failTable } = {}) {
  const calls = [];
  const today = new Date().toISOString();
  const tables = {
    marketplace_sellers: [{ id: 'seller', owner_role: 'marketplace_user', commission_rate_override: null }],
    marketplace_ledger_entries: [
      { amount: 100, available_at: '2000-01-01T00:00:00Z', payout_id: null },
      { amount: -10, available_at: '2000-01-01T00:00:00Z', payout_id: null },
      { amount: 50, available_at: '2099-01-01T00:00:00Z', payout_id: null },
      { amount: 20, available_at: null, payout_id: null },
      { amount: 99, available_at: '2000-01-01T00:00:00Z', payout_id: 'paid' },
    ],
    marketplace_payouts: [{ amount: 30, status: 'pending' }, { amount: 40, status: 'processing' }, { amount: 99, status: 'paid' }],
    marketplace_orders: [
      { seller_net: 80, gross_amount: 100, status: 'paid', paid_at: today, created_at: today },
      { seller_net: 20, gross_amount: 25, status: 'completed', paid_at: null, created_at: today },
      { seller_net: 500, status: 'pending', paid_at: null, created_at: today },
      { seller_net: 35, gross_amount: 45, status: 'paid', paid_at: '2000-01-01T00:00:00Z', created_at: '2000-01-01T00:00:00Z' },
    ],
    marketplace_finance_settings: [{ payout_day: 5 }],
  };
  const database = { from: table => {
    assert.ok(tables[table], `unexpected table ${table}`);
    let rows = tables[table];
    const result = () => ({ data: rows, error: failTable === table ? { message: 'unavailable' } : null });
    const query = {
      select: columns => { calls.push({ table, columns }); return query; },
      eq: () => query, order: () => query, or: () => query,
      is: (column, value) => { rows = rows.filter(row => row[column] === value); return query; },
      in: (column, values) => { rows = rows.filter(row => values.includes(row[column])); return query; },
      maybeSingle: async () => ({ ...result(), data: rows[0] }),
      then: resolve => resolve(result()),
    };
    return query;
  } };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/supabase-admin': { supabaseAdmin: database },
    'src/lib/auth-token': { requireAuthenticated: () => authorized ? { sub: 'user', role: 'marketplace_user' } : null },
    'src/lib/financial-data-cipher': { revealPayoutSnapshot: value => value },
    'src/sections/marketplace/admin/server/finance': { getFinanceSettings: async () => ({ payout_day: 5, commission_rate: 10 }) },
  };
  const exports = {};
  const source = readFileSync(new URL('../../src/app/api/marketplace/seller/finance/route.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, require: name => { assert.ok(mocks[name], name); return mocks[name]; },
  });
  return { ...exports, calls };
}

test('dashboard summary matches full finance balances without transaction joins or sensitive account fields', async () => {
  const summaryRoute = financeRoute();
  const summary = await summaryRoute.GET({ url: 'https://example.test/finance?summary=1' });
  const full = await financeRoute().GET({ url: 'https://example.test/finance' });
  assert.equal(summary.status, 200);
  for (const key of ['available', 'pending', 'processing', 'todayIncome', 'monthIncome']) {
    assert.equal(summary.body.balance[key], full.body.balance[key], key);
  }
  assert.equal(summary.body.balance.available, 90);
  assert.equal(summary.body.balance.pending, 70);
  assert.equal(summary.body.balance.processing, 70);
  assert.equal(summary.body.balance.todayIncome, 100);
  assert.equal(summary.body.schedule.nextPayoutAt, full.body.schedule.nextPayoutAt);
  assert.equal(summary.body.orders, undefined);
  assert.equal(summary.body.ledger, undefined);
  assert.ok(summaryRoute.calls.every(({ columns }) => !columns.includes(':') && columns !== '*'));
});

test('summary enforces authentication and surfaces database errors', async () => {
  assert.equal((await financeRoute({ authorized: false }).GET({})).status, 401);
  assert.equal((await financeRoute({ failTable: 'marketplace_orders' }).GET({ url: 'https://example.test/finance?summary=1' })).status, 500);
});

for (const status of ['active', 'suspended']) {
test(`opening a ${status} system store does not provision or write the seller again`, async () => {
  const exports = {};
  const seller = { id: 'seller', owner_role: 'master_admin', status };
  const database = { from: table => {
    const query = {
      select: () => query, eq: () => query, limit: () => query,
      maybeSingle: async () => ({ data: table === 'marketplace_sellers' ? seller : null }),
      then: resolve => resolve({ data: [] }),
    };
    return query;
  } };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/supabase-admin': { supabaseAdmin: database },
    'src/lib/auth-token': { requireAuthenticated: () => ({ sub: 'admin', role: 'master_admin' }) },
    'src/lib/auth-rate-limit': {},
    'src/lib/request-security': {},
    'src/lib/financial-data-cipher': { revealPayoutAccount: value => value },
    'src/sections/marketplace/shared/thai-banks': {},
    'src/sections/marketplace/seller/server/system-seller': { provisionEkruSystemSeller: () => assert.fail('active store should not be written again') },
    'src/sections/marketplace/admin/server/line-notifications': {},
  };
  const source = readFileSync(new URL('../../src/app/api/marketplace/seller/route.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, require: name => { assert.ok(mocks[name], name); return mocks[name]; },
  });
  const response = await exports.GET({ url: 'https://example.test/seller' });
  assert.equal(response.status, 200);
  assert.equal(response.body.seller.id, seller.id);
});

}
