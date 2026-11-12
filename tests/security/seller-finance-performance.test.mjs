import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function load(settingsError = null) {
  const selections = [];
  const now = new Date().toISOString();
  const records = {
    marketplace_sellers: { id: 's', owner_role: 'marketplace_user', commission_rate_override: null },
    marketplace_finance_settings: { minimum_payout: 250, payout_day: 5, hold_days: 3, commission_rate: 10 },
    marketplace_ledger_entries: [{ amount: 80, available_at: '2020-01-01', payout_id: null }],
    marketplace_payouts: [{ amount: 50, status: 'paid' }],
    marketplace_orders: [
      { id: 'paid', status: 'paid', gross_amount: 100, seller_net: 80, paid_at: now, created_at: now, buyer_id: 'private' },
      { id: 'pending', status: 'payment_review', gross_amount: 30, seller_net: 24, created_at: now },
    ],
  };
  const exports = {};
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/auth-token': { requireAuthenticated: () => ({ sub: 'owner', role: 'marketplace_user' }) },
    'src/lib/financial-data-cipher': {},
    'src/sections/marketplace/admin/server/finance': { DEFAULT_FINANCE_SETTINGS: {} },
    'src/lib/supabase-admin': { supabaseAdmin: { from: table => {
      const result = { data: records[table], error: table === 'marketplace_finance_settings' ? settingsError : null };
      const q = { select: columns => { selections.push({ table, columns }); return q; }, eq: () => q, order: () => q,
        maybeSingle: async () => result, then: resolve => Promise.resolve(result).then(resolve) };
      return q;
    } } },
  };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/app/api/marketplace/seller/finance/route.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, URL, require: name => mocks[name] ?? {} });
  return { ...exports, selections };
}

test('finance preserves balances and configured minimum without fetching secret settings', async () => {
  const api = load();
  const { body, status } = await api.GET({ url: 'https://example.test/finance' });
  assert.equal(status, 200);
  assert.equal(body.balance.available, 80);
  assert.equal(body.balance.paid, 50);
  assert.equal(body.balance.grossSales, 100);
  assert.equal(body.balance.underReview, 30);
  assert.equal(body.balance.todayIncome, 80);
  assert.equal(body.balance.monthIncome, 80);
  assert.equal(body.schedule.minimumPayout, 250);
  assert.equal(body.orders[0].buyer_id, null);
  assert.equal(body.payouts.length, 0);
  assert.equal(api.selections.find(x => x.table === 'marketplace_finance_settings').columns, 'payout_day, minimum_payout, hold_days, commission_rate');
});

test('finance fails explicitly when current financial settings cannot be read', async () => {
  const api = load({ message: 'settings unavailable' });
  const response = await api.GET({ url: 'https://example.test/finance' });
  assert.equal(response.status, 500);
  assert.equal(response.body.message, 'settings unavailable');
});
