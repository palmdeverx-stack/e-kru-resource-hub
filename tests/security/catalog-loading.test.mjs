import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function catalog({ databaseError = null, officialSellerIds = ['official-seller'] } = {}) {
  const calls = [];
  const filters = [];
  const products = Array.from({ length: 14 }, (_, index) => ({
    id: `product-${index}`, seller_id: index % 2 ? 'seller' : 'official-seller', title: `Resource ${index}`, status: 'published',
    price: 100, list_price: 150, currency: 'THB', images: [], cover_url: '/cover.png',
    reviews: [{ rating: 4 }, { rating: 5 }], seller: { owner_role: 'master_admin' },
  }));
  const database = {
    from: table => {
      assert.ok(['marketplace_products', 'marketplace_product_collections', 'marketplace_sellers'].includes(table), table);
      let rows = products;
      let from = 0;
      let to = products.length - 1;
      const query = {
        select: columns => { calls.push({ table, columns }); return query; },
        order: () => query, returns: () => query,
        eq: (key, value) => { filters.push(['eq', key, value]); return query; },
        neq: (key, value) => { filters.push(['neq', key, value]); return query; },
        in: (key, values) => { filters.push(['in', key, values]); if (table === 'marketplace_products' && key === 'seller_id') rows = rows.filter(row => values.includes(row.seller_id)); return query; },
        not: (key, operator, value) => { filters.push(['not', key, operator, value]); if (key === 'seller_id') rows = rows.filter(row => !value.slice(1, -1).split(',').includes(row.seller_id)); return query; },
        or: () => query, gt: () => query,
        range: (start, end) => { from = start; to = end; return query; },
        then: resolve => resolve({ data: table === 'marketplace_products' ? rows.slice(from, to + 1) : table === 'marketplace_sellers' ? officialSellerIds.map(id => ({ id })) : [], error: databaseError }),
      };
      return query;
    },
    rpc: async name => {
      assert.equal(name, 'marketplace_product_engagement_counts');
      return { data: products.map(product => ({ product_id: product.id, views: 3, purchases: 2 })) };
    },
  };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/auth-token': { requireAuthenticated: () => null },
    'src/lib/supabase-admin': { supabaseAdmin: database },
    'src/lib/request-security': {},
    'src/sections/marketplace/shipping/server/config': { getMarketplaceShippingConfig: async () => ({ enabled: false, officialEnabled: false }) },
    'src/sections/marketplace/seller/server/system-seller': {},
    'src/sections/marketplace/seller/server/public-seller': { withPublicSystemStoreFlag: seller => { const { owner_role, ...rest } = seller; return { ...rest, is_system_store: owner_role === 'master_admin' }; } },
    'src/sections/marketplace/seller/server/seller-tools-access': { canViewSellerTools: async () => false, SELLER_TOOLS_CATEGORY: 'seller-tools' },
    'src/sections/marketplace/seller/server/product-media': { withMediaUrls: async product => product, getOfficialProductCoverFallback: async () => null },
  };
  const exports = {};
  const source = readFileSync(new URL('../../src/app/api/marketplace/products/route.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, require: name => { assert.ok(mocks[name], name); return mocks[name]; },
  });
  return { ...exports, calls, filters };
}

test('compact catalog keeps pagination, prices, ratings and sales while selecting only card data', async () => {
  const api = catalog();
  const result = await api.GET({ url: 'https://example.test/products?cards=1&limit=12' });
  assert.equal(result.status, 200);
  assert.equal(result.body.products.length, 12);
  assert.equal(result.body.hasMore, true);
  assert.equal(result.body.nextPage, 2);
  const product = result.body.products[0];
  assert.equal(product.price, 100);
  assert.equal(product.list_price, 150);
  assert.equal(product.engagement.averageRating, 4.5);
  assert.equal(product.engagement.purchases, 2);
  assert.equal(product.seller.owner_role, undefined);
  const columns = api.calls.find(call => call.table === 'marketplace_products').columns;
  assert.ok(!columns.includes('*'));
  assert.ok(!columns.includes('purchase_benefits_html'));
  assert.ok(!columns.includes('file_url'));
  assert.ok(columns.includes('short_description'));
});

test('catalog retains publication, seller-tool, shipping and category filters', async () => {
  const api = catalog();
  await api.GET({ url: 'https://example.test/products?cards=1&category=worksheets' });
  for (const expected of [['eq', 'status', 'published'], ['neq', 'category', 'seller-tools'], ['neq', 'resource_type', 'physical'], ['eq', 'category', 'worksheets']]) {
    assert.ok(api.filters.some(value => JSON.stringify(value) === JSON.stringify(expected)), JSON.stringify(expected));
  }
});

test('catalog reports database failures instead of a successful empty response', async () => {
  assert.equal((await catalog({ databaseError: { message: 'unavailable' } }).GET({ url: 'https://example.test/products?cards=1' })).status, 500);
});

test('community catalog excludes official sellers before applying pagination', async () => {
  const api = catalog();
  const result = await api.GET({ url: 'https://example.test/products?cards=1&excludeOfficial=1&limit=5' });
  assert.equal(result.status, 200);
  assert.equal(result.body.products.length, 5);
  assert.equal(result.body.hasMore, true);
  assert.ok(result.body.products.every(product => product.seller_id === 'seller'));
  assert.ok(api.filters.some(filter => filter[0] === 'not' && filter[1] === 'seller_id'));
});
test('official catalog still includes official sellers and takes precedence over exclusion', async () => {
  const result = await catalog().GET({ url: 'https://example.test/products?cards=1&official=1&excludeOfficial=1' });
  assert.equal(result.status, 200);
  assert.equal(result.body.products.length, 7);
  assert.ok(result.body.products.every(product => product.seller_id === 'official-seller'));
});
test('community catalog remains populated when no official sellers exist', async () => {
  const result = await catalog({ officialSellerIds: [] }).GET({ url: 'https://example.test/products?cards=1&excludeOfficial=1' });
  assert.equal(result.status, 200);
  assert.equal(result.body.products.length, 14);
});
