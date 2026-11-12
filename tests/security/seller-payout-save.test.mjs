import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function route(payoutError = null) {
  let payout = null;
  const database = { from: table => {
    let written = false;
    const query = {
      select: () => query, eq: () => query,
      upsert: (value, options) => {
        written = true;
        if (table === 'marketplace_seller_payout_accounts') {
          assert.equal(options.onConflict, 'seller_id');
          payout = value;
        }
        return query;
      },
      maybeSingle: async () => ({ data: table === 'marketplace_seller_payout_accounts' ? payout : null }),
      single: async () => ({ data: { id: 'seller', status: 'draft' } }),
      then: resolve => resolve(table === 'marketplace_seller_payout_accounts' && written ? { error: payoutError } : { data: [] }),
    };
    return query;
  } };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/supabase-admin': { supabaseAdmin: database },
    'src/lib/auth-token': { requireAuthenticated: () => ({ sub: 'user', role: 'marketplace_user' }) },
    'src/lib/auth-rate-limit': { isActionAllowed: async () => true },
    'src/lib/request-security': { rejectCrossSiteMutation: () => null },
    'src/lib/financial-data-cipher': { encryptPayoutAccountFields: () => ({ account_number: null, account_number_encrypted: 'encrypted' }), revealPayoutAccount: value => value },
    'src/sections/marketplace/shared/thai-banks': { findThaiBank: () => ({ code: '004', name: 'Bank' }) },
    'src/sections/marketplace/seller/server/system-seller': {},
    'src/sections/marketplace/admin/server/line-notifications': {},
  };
  const exports = {};
  const source = readFileSync(new URL('../../src/app/api/marketplace/seller/route.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, URL, require: name => { assert.ok(mocks[name], name); return mocks[name]; } });
  return { save: () => exports.POST({ url: 'https://example.test/seller', json: async () => ({ action: 'save_draft', wizardStep: 4, displayName: 'Store', bankCode: '004', bankName: 'Bank', accountNumber: '1234567890', accountName: 'Seller' }) }), payout: () => payout };
}

test('next-step draft save reports payout storage errors instead of success', async () => {
  const result = await route({ code: '23502', message: 'null violates constraint' }).save();
  assert.equal(result.status, 500);
  assert.match(result.body.message, /เลขบัญชีเข้ารหัส/);
});

test('next-step save persists encrypted bank details and returns the saved account', async () => {
  const api = route();
  const result = await api.save();
  assert.equal(result.status, 200);
  assert.equal(api.payout().account_number, null);
  assert.equal(api.payout().account_number_encrypted, 'encrypted');
  assert.equal(result.body.seller.payout_account.account_name, 'Seller');
});
