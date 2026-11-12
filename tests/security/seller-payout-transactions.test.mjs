import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function load(path, mocks) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(new URL('../../' + path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      URL,
      Date,
      console,
      Promise,
      require: (name) => {
        assert.ok(name in mocks, name);
        return mocks[name];
      },
    }
  );
  return exports;
}
function setup({
  error = null,
  alreadyProcessed = false,
  authorized = true,
  pin = true,
  notificationError = false,
} = {}) {
  const calls = [],
    notices = [];
  const account = {
    bank_code: '004',
    bank_name: 'Bank',
    account_name: 'Owner',
    account_number: '1234567890',
  };
  const db = {
    from: (table) => {
      assert.equal(
        table,
        'marketplace_seller_payout_accounts',
        'financial writes must use a single RPC'
      );
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: account, error: null }),
      };
      return query;
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      return {
        error,
        data:
          name === 'create_marketplace_seller_payout'
            ? { id: 'payout', amount: 100 }
            : {
                payout: { id: 'payout', amount: 100 },
                owner_id: 'seller-owner',
                already_processed: alreadyProcessed,
              },
      };
    },
  };
  const mocks = {
    'next/server': {
      NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) },
    },
    'src/lib/supabase-admin': { supabaseAdmin: db },
    'src/lib/auth-token': {
      requireRole: () => (authorized ? { sub: 'admin' } : null),
      hasPayoutAccess: () => pin,
    },
    'src/lib/request-security': { rejectCrossSiteMutation: () => null },
    'src/lib/financial-data-cipher': {
      revealPayoutAccount: (value) => value,
      revealPayoutSnapshot: (value) => value,
      encryptFinancialValue: () => 'fin-v1.fixture-encrypted',
    },
    'src/sections/marketplace/admin/server/finance': {},
    'src/lib/notifications': {
      createNotifications: async (value) => {
        notices.push(value);
        if (notificationError) throw new Error('notification unavailable');
      },
    },
    'src/lib/security-audit': { writeSecurityAudit: async () => {} },
  };
  return {
    calls,
    notices,
    create: () =>
      load('src/app/api/marketplace/admin/payouts/route.ts', mocks).POST({
        json: async () => ({ sellerId: 'seller' }),
      }),
    finish: (body = { status: 'paid', transferReference: 'ref-fixture' }) =>
      load('src/app/api/marketplace/admin/payouts/[id]/route.ts', mocks).PATCH(
        { json: async () => body },
        { params: Promise.resolve({ id: 'payout' }) }
      ),
  };
}

test('payout creation delegates amount and reservation to one atomic RPC with encrypted bank snapshot', async () => {
  const api = setup();
  assert.equal((await api.create()).status, 201);
  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0].name, 'create_marketplace_seller_payout');
  assert.equal(api.calls[0].args.p_account_number_encrypted, 'fin-v1.fixture-encrypted');
  assert.ok(!JSON.stringify(api.calls).includes('1234567890'));
  assert.ok(!('p_amount' in api.calls[0].args));
});
test('payout result and release are committed by one RPC', async () => {
  const api = setup();
  assert.equal((await api.finish({ status: 'failed', failureReason: 'bank failed' })).status, 200);
  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0].name, 'finish_marketplace_seller_payout');
  assert.equal(api.calls[0].args.p_status, 'failed');
});
test('duplicate success skips secondary notifications', async () => {
  const api = setup({ alreadyProcessed: true });
  assert.equal((await api.finish()).body.alreadyProcessed, true);
  assert.equal(api.notices.length, 0);
});
test('financial conflict, duplicate reference and missing migration do not report success', async () => {
  for (const [code, expected] of [
    ['P0001', 409],
    ['23505', 409],
    ['PGRST202', 503],
    ['XX000', 500],
  ]) {
    const api = setup({ error: { code } });
    assert.equal((await api.finish()).status, expected);
    assert.equal(api.notices.length, 0);
  }
});
test('notification failure after commit does not turn a successful bank-result record into an error', async () => {
  assert.equal((await setup({ notificationError: true }).finish()).status, 200);
});
test('begin-processing records no completed-transfer notification', async () => {
  const api = setup();
  assert.equal((await api.finish({ status: 'processing' })).status, 200);
  assert.equal(api.notices.length, 0);
});
test('payout writes require administrator and finance PIN', async () => {
  for (const config of [{ authorized: false }, { pin: false }]) {
    const api = setup(config);
    assert.ok([401, 403].includes((await api.create()).status));
    assert.ok([401, 403].includes((await api.finish()).status));
    assert.equal(api.calls.length, 0);
  }
});
