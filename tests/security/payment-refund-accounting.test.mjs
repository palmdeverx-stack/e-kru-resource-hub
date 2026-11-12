import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function load({ full = true, duplicate = false, rpcError = false, revokeError = false } = {}) {
  const calls = { rpc: [], revoked: 0, orderUpdates: 0, notices: 0 };
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    maybeSingle: async () => ({ data: { id: 'session', buyer_id: 'buyer' }, error: null }),
    update: () => {
      calls.orderUpdates++;
      return query;
    },
    then: (resolve) => resolve({ error: null }),
  };
  const mocks = {
    'next/server': {},
    'src/lib/supabase-admin': {
      supabaseAdmin: {
        from: (table) => {
          assert.ok(['marketplace_payment_sessions', 'marketplace_orders'].includes(table));
          return query;
        },
        rpc: async (name, args) => {
          calls.rpc.push({ name, args });
          return {
            data: { full_refund: full, already_processed: duplicate },
            error: rpcError ? new Error('database unavailable') : null,
          };
        },
      },
    },
    'src/lib/notifications': {
      createNotifications: async () => {
        calls.notices++;
      },
    },
    'src/sections/marketplace/checkout/server/dispute-lifecycle': {},
    'src/sections/marketplace/checkout/server/finalize-payment': {},
    'src/sections/marketplace/checkout/server/license-lifecycle': {
      revokeLicensesForPaymentSession: async () => {
        calls.revoked++;
        if (revokeError) throw new Error('license unavailable');
      },
    },
    'src/sections/marketplace/checkout/server/stripe': {},
    'src/sections/marketplace/checkout/server/license-subscriptions': {},
  };
  const exports = {};
  const source =
    readFileSync(new URL('../../src/app/api/stripe/webhook/route.ts', import.meta.url), 'utf8') +
    '\nexports.refund = refundStripePayment;';
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      Date,
      Error,
      require: (name) => {
        assert.ok(name in mocks, name);
        return mocks[name];
      },
    }
  );
  return {
    calls,
    run: () =>
      exports.refund({
        id: 'ch_fixture',
        payment_intent: 'pi_fixture',
        amount: 10000,
        amount_refunded: full ? 10000 : 2500,
      }),
  };
}
test('refund books cumulative cents through the atomic RPC before revoking access', async () => {
  const api = load();
  assert.equal(await api.run(), 'session');
  assert.equal(api.calls.rpc[0].name, 'reconcile_marketplace_stripe_refund');
  assert.equal(api.calls.rpc[0].args.p_charge_amount, 10000);
  assert.equal(api.calls.rpc[0].args.p_refunded_amount, 10000);
  assert.equal(api.calls.revoked, 1);
  assert.equal(api.calls.orderUpdates, 1);
});
test('partial refund books money but keeps licenses and paid order intact', async () => {
  const api = load({ full: false });
  await api.run();
  assert.equal(api.calls.rpc[0].args.p_refunded_amount, 2500);
  assert.equal(api.calls.revoked, 0);
  assert.equal(api.calls.orderUpdates, 0);
});
test('duplicate accounting still retries interrupted fulfillment without another notification', async () => {
  const api = load({ duplicate: true });
  await api.run();
  assert.equal(api.calls.revoked, 1);
  assert.equal(api.calls.orderUpdates, 1);
  assert.equal(api.calls.notices, 0);
});
test('accounting failure prevents successful refund fulfillment and propagates for webhook retry', async () => {
  const api = load({ rpcError: true });
  await assert.rejects(api.run(), /database unavailable/);
  assert.equal(api.calls.revoked, 0);
  assert.equal(api.calls.notices, 0);
});
test('failed license revocation propagates so a duplicate event can recover', async () => {
  const api = load({ revokeError: true });
  await assert.rejects(api.run(), /license unavailable/);
  assert.equal(api.calls.orderUpdates, 0);
});
