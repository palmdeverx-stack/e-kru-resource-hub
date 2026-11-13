import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function setup(existing, { missingStore = false } = {}) {
  const writes = [];
  const database = {
    from(table) {
      let payload;
      const query = {
        select: () => query,
        eq: (key, value) => {
          if (table === 'marketplace_sellers' && key === 'id') assert.equal(value, 'official-store');
          if (table === 'marketplace_products' && key === 'seller_id') assert.equal(value, 'official-store');
          return query;
        }, in: () => query,
        contains: () => query, limit: () => query,
        maybeSingle: async () => ({ data: table === 'marketplace_products' ? existing : table === 'marketplace_sellers' ? missingStore ? null : { id: 'official-store' } : { id: 'media' } }),
        then: resolve => resolve({ data: [] }),
        update: value => { payload = value; writes.push({ mode: 'update', value }); return query; },
        insert: value => { payload = value; writes.push({ mode: 'insert', value }); return query; },
        single: async () => ({ data: { id: 'product', status: payload.status ?? existing?.status } }),
      };
      return query;
    },
  };
  const mocks = {
    'server-only': {},
    'src/lib/supabase-admin': { supabaseAdmin: database },
    '../line-feature': {
      MARKETPLACE_SELLER_LINE_STORE_ID: 'official-store',
      MARKETPLACE_SELLER_LINE_FEATURE_KEY: 'byoa',
      MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY: 'managed',
      MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY: 'trial',
    },
  };
  const exports = {};
  const source = readFileSync(new URL('../../src/sections/marketplace/seller/server/seller-line-product.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: name => { assert.ok(mocks[name], name); return mocks[name]; },
  });
  return { sync: exports.syncSellerLineFeatureProducts, writes };
}

const input = {
  adminUserId: 'admin', enabled: true,
  byoa: { price: 99, description: 'Own OA' },
  managed: { price: 99, description: 'System OA', quota: 100 },
  trial: { description: 'Trial', durationDays: 7, quota: 10 },
};

test('repair keeps archived packages archived and preserves review dates on repeated sync', async () => {
  const api = setup({ id: 'existing', status: 'archived' });
  for (let i = 0; i < 2; i += 1) {
    const result = await api.sync({ ...input, overwriteStatus: false });
    assert.ok(result.every(product => product.status === 'archived'));
  }
  assert.equal(api.writes.length, 6);
  for (const { mode, value } of api.writes) {
    assert.equal(mode, 'update');
    for (const key of ['submitted_at', 'reviewed_at', 'reviewed_by', 'status']) {
      assert.equal(Object.hasOwn(value, key), false, key);
    }
  }
});

test('new packages receive initial review dates and publication status', async () => {
  const api = setup(null);
  await api.sync(input);
  assert.equal(api.writes.length, 3);
  for (const { mode, value } of api.writes) {
    assert.equal(mode, 'insert');
    assert.equal(value.status, 'published');
    assert.ok(Number.isFinite(Date.parse(value.submitted_at)));
    assert.equal(value.reviewed_by, 'admin');
  }
});

test('explicit settings sync changes publication status without moving review dates', async () => {
  const api = setup({ id: 'existing', status: 'published' });
  await api.sync({ ...input, enabled: false });
  for (const { value } of api.writes) {
    assert.equal(value.status, 'archived');
    assert.equal(Object.hasOwn(value, 'submitted_at'), false);
  }
});

test('different admins sync packages into the same official store', async () => {
  const api = setup(null);
  await api.sync({ ...input, adminUserId: 'admin-a' });
  await api.sync({ ...input, adminUserId: 'admin-b' });
  assert.equal(api.writes.length, 6);
  assert.ok(api.writes.every(({ value }) => value.seller_id === 'official-store'));
});

test('missing official store fails without creating a store or packages', async () => {
  const api = setup(null, { missingStore: true });
  await assert.rejects(api.sync(input), /E-KRU/);
  assert.equal(api.writes.length, 0);
});
