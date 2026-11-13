import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('src/app/api/marketplace/seller/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture({ role = 'master_admin', userId = 'admin-b', ownerRole = 'master_admin', status = 'active', missing = false, queryError = false, crossSite = false, rateAllowed = true } = {}) {
  const target = { id: 'official-store', owner_id: 'admin-a', owner_role: ownerRole, status, display_name: 'E-KRU' };
  const provisionedOwners = [], payouts = [];
  const database = { from(table) {
    const query = {
      select: () => query,
      eq: (column, value) => { if (table === 'marketplace_sellers') { assert.equal(column, 'id'); assert.equal(value, target.id); } return query; },
      maybeSingle: async () => ({ data: table === 'marketplace_sellers' ? missing ? null : target : null, error: queryError ? { message: 'fixture' } : null }),
      upsert(value) { payouts.push(value); return query; },
      then(resolve) { resolve({ data: [], error: null }); },
    };
    return query;
  } };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/supabase-admin': { supabaseAdmin: database },
    'src/lib/auth-token': { requireAuthenticated: () => role ? { sub: userId, role } : null },
    'src/lib/auth-rate-limit': { isActionAllowed: async () => rateAllowed },
    'src/lib/request-security': { rejectCrossSiteMutation: () => crossSite ? { status: 403 } : null },
    'src/lib/financial-data-cipher': { revealPayoutAccount: value => value, encryptPayoutAccountFields: () => ({ account_number_encrypted: 'fixture' }) },
    'src/sections/marketplace/shared/thai-banks': { findThaiBank: () => ({ code: '004', name: 'Fixture bank' }) },
    'src/sections/marketplace/seller/server/system-seller': { provisionEkruSystemSeller: async ownerId => { provisionedOwners.push(ownerId); return { data: target }; } },
    'src/sections/marketplace/admin/server/line-notifications': {},
  };
  const exports = {};
  vm.runInNewContext(source, { exports, URL, require(name) { assert.ok(mocks[name], name); return mocks[name]; } });
  const request = { url: 'https://example.test/api/marketplace/seller?sellerId=official-store&edit=1', json: async () => ({ sellerId: target.id, displayName: 'E-KRU updated', bankCode: '004', bankName: 'Fixture bank', accountName: 'Official store', accountNumber: '1234567890' }) };
  return { get: () => exports.GET(request), save: () => exports.POST(request), provisionedOwners, payouts };
}

for (const userId of ['admin-a', 'admin-b']) {
  test(`${userId} can open and update the same official store without transferring ownership`, async () => {
    const api = fixture({ userId });
    const read = await api.get();
    assert.equal(read.status, 200);
    assert.equal(read.body.seller.id, 'official-store');
    assert.equal(api.provisionedOwners.length, 0);
    const saved = await api.save();
    assert.equal(saved.status, 200);
    assert.equal(saved.body.seller.owner_id, 'admin-a');
    assert.deepEqual(api.provisionedOwners, ['admin-a']);
    assert.equal(api.payouts[0].seller_id, 'official-store');
  });
}

for (const role of [null, 'marketplace_user', 'teacher', 'school_admin', 'marketplace_admin']) {
  test(`${role ?? 'anonymous'} cannot read or update another official store`, async () => {
    const api = fixture({ role });
    const status = role ? 403 : 401;
    assert.equal((await api.get()).status, status);
    assert.equal((await api.save()).status, status);
    assert.equal(api.provisionedOwners.length, 0);
    assert.equal(api.payouts.length, 0);
  });
}

test('explicit targeting does not grant access to ordinary sellers or bypass CSRF and rate limits', async () => {
  const ordinary = fixture({ ownerRole: 'marketplace_user' });
  assert.equal((await ordinary.get()).status, 403);
  assert.equal((await ordinary.save()).status, 403);
  assert.equal(ordinary.provisionedOwners.length, 0);
  for (const [options, status] of [[{ missing: true }, 404], [{ queryError: true }, 500], [{ crossSite: true }, 403], [{ rateAllowed: false }, 429]]) {
    const api = fixture(options);
    assert.equal((await api.save()).status, status);
    assert.equal(api.provisionedOwners.length, 0);
    assert.equal(api.payouts.length, 0);
  }
});

function suspendedAccountFixture(activeCount = 1) {
  const suspended = { id: 'old-store', owner_id: 'admin-b', owner_role: 'master_admin', status: 'suspended' };
  const active = { id: 'official-store', owner_id: 'admin-a', owner_role: 'master_admin', status: 'active' };
  const provisionedOwners = [];
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/supabase-admin': { supabaseAdmin: { from(table) {
      const filters = [];
      const query = {
        select: () => query,
        eq: (key, value) => { filters.push([key, value]); return query; },
        maybeSingle: async () => ({ data: table === 'marketplace_sellers' ? suspended : null }),
        limit: async size => {
          assert.equal(size, 2);
          assert.deepEqual(filters, [['owner_role', 'master_admin'], ['status', 'active']]);
          return { data: Array.from({ length: activeCount }, (_, index) => ({ ...active, id: index ? 'other-official-store' : active.id })) };
        },
        upsert: () => query,
        then: resolve => resolve({ data: [], error: null }),
      };
      return query;
    } } },
    'src/lib/auth-token': { requireAuthenticated: () => ({ sub: 'admin-b', role: 'master_admin' }) },
    'src/lib/auth-rate-limit': { isActionAllowed: async () => true },
    'src/lib/request-security': { rejectCrossSiteMutation: () => null },
    'src/lib/financial-data-cipher': { revealPayoutAccount: value => value, encryptPayoutAccountFields: () => ({ account_number_encrypted: 'fixture' }) },
    'src/sections/marketplace/shared/thai-banks': { findThaiBank: () => ({ code: '004', name: 'Fixture bank' }) },
    'src/sections/marketplace/seller/server/system-seller': { provisionEkruSystemSeller: async owner => { provisionedOwners.push(owner); return { data: active }; } },
    'src/sections/marketplace/admin/server/line-notifications': {},
  };
  const exports = {};
  vm.runInNewContext(source, { exports, URL, require(name) { assert.ok(mocks[name], name); return mocks[name]; } });
  const request = { url: 'https://example.test/api/marketplace/seller', json: async () => ({ displayName: 'E-KRU', bankCode: '004', accountNumber: '1234567890', accountName: 'Official store' }) };
  return { get: summary => exports.GET({ ...request, url: request.url + (summary ? '?summary=1' : '?edit=1') }), save: () => exports.POST(request), provisionedOwners };
}

test('the second admin opens the active shared official store instead of their suspended duplicate', async () => {
  const api = suspendedAccountFixture();
  for (const summary of [false, true]) {
    const result = await api.get(summary);
    assert.equal(result.status, 200);
    assert.equal(result.body.seller.id, 'official-store');
    assert.equal(result.body.seller.status, 'active');
  }
  assert.equal(api.provisionedOwners.length, 0);
  assert.equal((await api.save()).status, 200);
  assert.deepEqual(api.provisionedOwners, ['admin-a']);
});

test('ambiguous or absent active stores cannot reactivate or update the suspended duplicate', async () => {
  for (const count of [0, 2]) {
    const api = suspendedAccountFixture(count);
    assert.equal((await api.get(false)).body.seller.status, 'suspended');
    assert.equal((await api.save()).status, 409);
    assert.equal(api.provisionedOwners.length, 0);
  }
});


test('explicitly targeting a suspended official store does not reactivate it', async () => {
  const api = fixture({ status: 'suspended' });
  assert.equal((await api.save()).status, 403);
  assert.equal(api.provisionedOwners.length, 0);
  assert.equal(api.payouts.length, 0);
});
