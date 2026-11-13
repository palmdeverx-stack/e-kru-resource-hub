import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function fixture(directoryResult) {
  const rows = [
    { id: 'official', display_name: 'A Official', owner_role: 'master_admin', status: 'active' },
    { id: 'member-1', display_name: 'B Teacher', owner_role: 'teacher', status: 'active' },
    { id: 'member-2', display_name: 'C Creator', owner_role: 'marketplace_user', status: 'active' },
    { id: 'official-2', display_name: 'D Official', owner_role: 'master_admin', status: 'active' },
    { id: 'member-3', display_name: 'E Publisher', owner_role: 'marketplace_user', status: 'active' },
    { id: 'suspended', display_name: 'F Hidden', owner_role: 'teacher', status: 'suspended' },
  ];
  for (const row of rows) Object.assign(row, {
    bio: 'Public bio', logo_url: '/logo.png', cover_url: '/cover.png', seller_name: 'Private name',
    phone: '0000000000', contact_email: 'private@example.test',
    seller_agreement_accepted_at: '2026-01-01', copyright_confirmed_at: '2026-01-01',
    fee_agreement_accepted_at: '2026-01-01', pdpa_accepted_at: '2026-01-01',
    document_count: [{ count: 1 }], payout_count: [{ count: 1 }],
  });
  const enrichedIds = [];
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/supabase-admin': { supabaseAdmin: {
      from(table) {
        let current = rows, start = 0, end = rows.length;
        const query = {
          select: () => query,
          eq: (key, value) => { current = current.filter(row => row[key] === value); return query; },
          neq: (key, value) => { current = current.filter(row => row[key] !== value); return query; },
          in: () => query,
          order: () => query,
          range: (from, to) => { start = from; end = to + 1; return query; },
          or: filter => { const needle = filter.match(/ilike\.%([^%]+)%/)[1].toLowerCase(); current = current.filter(row => row.display_name.toLowerCase().includes(needle)); return query; },
          then(resolve) { resolve({ data: table === 'marketplace_sellers' ? current.slice(start, end) : [], count: current.length, error: null }); },
        };
        return query;
      },
      rpc: async (name) => name === 'marketplace_public_store_directory'
        ? (directoryResult ?? { data: null, error: { code: 'PGRST202' } }) : { data: [] },
    } },
    'src/sections/marketplace/seller/server/seller-badges': { getPublicSellerBadges: async ids => { enrichedIds.push(...ids); return new Map(); } },
    'src/sections/marketplace/seller/server/seller-completion': { getSellerProfileCompletionsByIds: async () => new Map() },
  };
  function load(path, dependencies) {
    const exports = {};
    const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(source, { exports, URL, require(name) { if (name === 'server-only') return {}; assert.ok(dependencies[name], name); return dependencies[name]; } });
    return exports;
  }
  const completion = load('src/sections/marketplace/shared/seller-completion.ts', {});
  const directory = load('src/sections/marketplace/seller/server/public-store-directory.ts', {
    'next/cache': { unstable_cache: fn => fn },
    'src/lib/supabase-admin': mocks['src/lib/supabase-admin'],
    './seller-badges': mocks['src/sections/marketplace/seller/server/seller-badges'],
    '../../shared/seller-completion': completion,
  });
  const exports = load('src/app/api/marketplace/stores/route.ts', {
    'next/server': mocks['next/server'],
    'src/sections/marketplace/seller/server/public-store-directory': directory,
  });
  return { get: query => exports.GET({ url: 'https://example.test/api/marketplace/stores?' + query }), enrichedIds };
}

test('store directory filters official stores before pagination and counts', async () => {
  const api = fixture();
  const first = await api.get('limit=2');
  assert.equal(first.status, 200);
  assert.deepEqual(Array.from(first.body.stores, store => store.id), ['member-1', 'member-2']);
  assert.equal(first.body.total, 3);
  assert.equal(first.body.totalPages, 2);
  const second = await api.get('limit=2&page=2');
  assert.deepEqual(Array.from(second.body.stores, store => store.id), ['member-3']);
  assert.equal(second.body.total, 3);
  assert.ok(!api.enrichedIds.includes('official'));
  assert.ok(!api.enrichedIds.includes('official-2'));
});

test('searching for official stores returns an empty directory result', async () => {
  const response = await fixture().get('q=Official');
  assert.equal(response.body.stores.length, 0);
  assert.equal(response.body.total, 0);
  assert.equal(response.body.totalPages, 0);
});


test('completion uses aggregate document counts without exposing private seller fields', async () => {
  const result = await fixture().get('limit=2');
  for (const store of result.body.stores) {
    assert.equal(store.profile_completion, 100);
    for (const key of ['seller_name', 'phone', 'contact_email', 'document_count', 'payout_count', 'owner_role'])
      assert.equal(store[key], undefined, key);
  }
});

test('directory uses the combined RPC without legacy enrichment when available', async () => {
  const api = fixture({ data: { stores: [{ id: 'rpc-store' }], total: 1, page: 1, totalPages: 1 }, error: null });
  const response = await api.get('');
  assert.equal(response.status, 200);
  assert.equal(response.body.stores[0].id, 'rpc-store');
  assert.equal(api.enrichedIds.length, 0);
});

test('directory does not hide operational RPC errors behind fallback', async () => {
  const response = await fixture({ data: null, error: { code: '57014', message: 'timeout' } }).get('');
  assert.equal(response.status, 500);
  assert.equal(response.body.stores, undefined);
});
