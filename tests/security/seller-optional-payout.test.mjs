import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { z } from 'zod';

const setupSource = readFileSync(new URL('../../src/sections/marketplace/seller/view/seller-setup-view.tsx', import.meta.url), 'utf8');
test('seller signup requires payout details as well as seller identity and agreements', () => {
  const start = setupSource.indexOf('const SellerSetupSchema =');
  const end = setupSource.indexOf('type SellerSetupSchemaType', start);
  assert.ok(start >= 0 && end > start);
  const compiled = ts.transpileModule(`${setupSource.slice(setupSource.indexOf('const SELLER_TYPE_VALUES ='), setupSource.indexOf('const SELLER_TYPE_OPTIONS'))}\n${setupSource.slice(start, end)}\nexports.schema = SellerSetupSchema;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { z, exports });
  const valid = {
    sellerType: 'individual', displayName: 'Test shop', displayNameEn: '', slug: 'test-shop', bio: '',
    sellerName: 'Test Seller', phone: '0812345678', contactEmail: 'test@example.com', nationalTaxId: '',
    companyName: '', companyRegistrationNo: '', companyTaxId: '', businessAddress: '',
    bankCode: '004', bankName: 'Bank', accountNumber: '1234567890', accountName: 'Test Seller', promptpayId: '',
    sellerAgreement: true, copyrightConfirmed: true, feeAgreement: true, pdpaAccepted: true,
  };
  assert.equal(exports.schema.safeParse(valid).success, true);
  for (const phone of ['081234567', '08123456789', '081abc5678', '+66812345678']) {
    assert.equal(exports.schema.safeParse({ ...valid, phone }).success, false, phone);
  }
  assert.equal(exports.schema.safeParse({ ...valid, bankName: '', accountName: '', accountNumber: '' }).success, false);
  assert.equal(exports.schema.safeParse({ ...valid, sellerAgreement: false }).success, false);
  assert.equal(exports.schema.safeParse({ ...valid, contactEmail: 'invalid' }).success, false);
});

test('payout rejects absent or incomplete bank details before creating a transfer', async () => {
  for (const account of [null, {}, { bank_code: '004', bank_name: 'Bank', account_name: 'Seller', account_number: '123' }, { bank_name: 'Bank', account_name: 'Seller', account_number: '1234567890' }]) {
    const exports = {};
    const database = { from: table => {
      assert.ok(['marketplace_seller_payout_accounts', 'marketplace_ledger_entries'].includes(table), 'must not create payout');
      const query = { select: () => query, eq: () => query, is: () => query, lte: () => query,
        maybeSingle: async () => ({ data: account }), then: resolve => resolve({ data: [] }) };
      return query;
    } };
    const mocks = {
      'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
      'src/lib/supabase-admin': { supabaseAdmin: database },
      'src/lib/auth-token': { requireRole: () => ({ sub: 'admin' }), hasPayoutAccess: () => true },
      'src/lib/request-security': { rejectCrossSiteMutation: () => null },
      'src/lib/financial-data-cipher': { revealPayoutAccount: value => value },
      'src/sections/marketplace/admin/server/finance': { getFinanceSettings: async () => ({ minimum_payout: 100 }) },
    };
    const source = readFileSync(new URL('../../src/app/api/marketplace/admin/payouts/route.ts', import.meta.url), 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
      exports, require: name => { assert.ok(mocks[name], name); return mocks[name]; },
    });
    const result = await exports.POST({ json: async () => ({ sellerId: 'seller' }) });
    assert.equal(result.status, 400);
    assert.match(result.body.message, /ก่อนเบิกเงิน/);
  }
});

test('admin rejects approval when seller has no payout account', async () => {
  const existing = {
    id: 'seller', status: 'pending', owner_role: 'marketplace_user', logo_url: '/logo.png',
    seller_name: 'Test Seller', phone: '0812345678', contact_email: 'test@example.com',
    seller_agreement_accepted_at: 'accepted', copyright_confirmed_at: 'accepted',
    fee_agreement_accepted_at: 'accepted', pdpa_accepted_at: 'accepted',
  };
  let saved;
  const database = { from: table => {
    assert.ok(['marketplace_sellers', 'marketplace_seller_payout_accounts'].includes(table));
    const query = {
      select: () => query, eq: () => query,
      update: value => { if (table === 'marketplace_sellers') saved = value; return query; },
      maybeSingle: async () => ({ data: table === 'marketplace_seller_payout_accounts' ? null : saved ? { ...existing, ...saved } : existing }),
      then: resolve => resolve({ data: null }),
    };
    return query;
  } };
  const exports = {};
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/supabase-admin': { supabaseAdmin: database },
    'src/lib/auth-token': { requireRole: () => ({ sub: 'admin', role: 'master_admin' }) },
    'src/lib/request-security': { rejectCrossSiteMutation: () => null },
    'src/lib/security-audit': { writeSecurityAudit: async () => {} },
  };
  const source = readFileSync(new URL('../../src/app/api/marketplace/admin/sellers/[id]/review/route.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: name => { assert.ok(mocks[name], name); return mocks[name]; },
  });
  const result = await exports.PATCH({ json: async () => ({ action: 'approve' }) }, { params: Promise.resolve({ id: 'seller' }) });
  assert.equal(result.status, 400);
  assert.equal(saved, undefined);
});
