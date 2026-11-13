import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function setup({ user = 'buyer', csrf = false, status = 'pending_payment', checkoutStatus = 'open', stripeError = false, rateAllowed = true } = {}) {
  const session = { id: 'payment', buyer_id: 'buyer', status, payment_method: 'stripe', stripe_checkout_session_id: 'checkout' };
  const orders = [
    { id: 'one', buyer_id: 'buyer', payment_session_id: 'payment', status: 'pending_payment' },
    { id: 'two', buyer_id: 'buyer', payment_session_id: 'payment', status: 'pending_payment' },
    { id: 'paid', buyer_id: 'buyer', payment_session_id: 'payment', status: 'paid' },
    { id: 'other', buyer_id: 'other', payment_session_id: 'other', status: 'pending_payment' },
  ];
  let expired = 0;
  const db = { from(table) {
    const filters = [];
    let update;
    const query = {
      select: () => query,
      eq: (key, value) => { filters.push(row => row[key] === value); return query; },
      in: (key, values) => { filters.push(row => values.includes(row[key])); return query; },
      update: value => { update = value; return query; },
      maybeSingle: async () => { const rows = run(); return { data: rows[0] ?? null }; },
      then: resolve => resolve({ data: run() }),
    };
    function run() {
      const rows = (table === 'marketplace_payment_sessions' ? [session] : table === 'marketplace_orders' ? orders : []).filter(row => filters.every(filter => filter(row)));
      if (update) rows.forEach(row => Object.assign(row, update));
      return rows;
    }
    return query;
  } };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/auth-token': { requireAuthenticated: () => user ? { sub: user } : null },
    'src/lib/auth-rate-limit': { isActionAllowed: async () => rateAllowed },
    'src/lib/request-security': { rejectCrossSiteMutation: () => csrf ? { status: 403 } : null },
    'src/lib/supabase-admin': { supabaseAdmin: db },
    'src/sections/marketplace/checkout/server/stripe': { getStripe: () => ({ checkout: { sessions: {
      retrieve: async () => ({ id: 'checkout', status: checkoutStatus, payment_status: checkoutStatus === 'complete' ? 'paid' : 'unpaid' }),
      expire: async () => { if (stripeError) throw Error('provider'); expired++; return { id: 'checkout', status: 'expired', payment_status: 'unpaid' }; },
    } } }) },
  };
  const exports = {};
  const source = readFileSync(new URL('../../src/app/api/marketplace/payments/[id]/cancel/route.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: name => { assert.ok(mocks[name], name); return mocks[name]; },
  });
  return { cancel: () => exports.POST({}, { params: Promise.resolve({ id: 'payment' }) }), session, orders, expired: () => expired };
}

test('cancellation expires Stripe then cancels unpaid orders together and can be retried', async () => {
  const api = setup();
  assert.equal((await api.cancel()).status, 200);
  assert.equal(api.expired(), 1);
  assert.equal(api.session.status, 'expired');
  assert.deepEqual(api.orders.map(row => row.status), ['cancelled', 'cancelled', 'paid', 'pending_payment']);
  assert.equal((await api.cancel()).status, 200);
});

for (const [config, expected] of [[{ user: null }, 401], [{ user: 'other' }, 404], [{ csrf: true }, 403], [{ rateAllowed: false }, 429], [{ status: 'verified' }, 409], [{ checkoutStatus: 'complete' }, 409], [{ stripeError: true }, 502]]) {
  test(`rejects cancellation safely: ${JSON.stringify(config)}`, async () => {
    const api = setup(config);
    assert.equal((await api.cancel()).status, expected);
    assert.equal(api.session.status, config.status ?? 'pending_payment');
    assert.equal(api.orders[0].status, 'pending_payment');
    assert.equal(api.expired(), 0);
  });
}
