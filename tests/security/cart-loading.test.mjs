import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function loadProduct(overrides = {}, { purchased = false, sellerTools = false } = {}) {
  const product = {
    id: 'product', status: 'published', category: 'resource', resource_type: 'digital',
    title: 'Test', price: 150, list_price: 200, file_url: '/private', external_links: ['private'],
    purchase_benefits_html: '<p>details</p>', seller: { id: 'seller', owner_role: 'master_admin', display_name: 'Store' },
    ...overrides,
  };
  let queried = 0;
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: product }) };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/auth-token': { requireAuthenticated: () => ({ sub: 'buyer' }) },
    'src/lib/supabase-admin': { supabaseAdmin: { from: () => { queried++; return query; } } },
    'src/sections/marketplace/seller/server/product-media': { withMediaUrls: async product => ({ ...product, cover_url: '/cover.png' }) },
    'src/sections/marketplace/seller/server/seller-completion': { getSellerProfileCompletionById: () => assert.fail('cart must not load seller completion') },
    'src/sections/marketplace/seller/server/seller-tools-access': { SELLER_TOOLS_CATEGORY: 'seller-tools', canViewSellerTools: async () => sellerTools },
    'src/sections/marketplace/shipping/server/config': { getMarketplaceShippingConfig: async () => ({}), isMarketplaceShippingEnabledForOfficialSeller: () => false },
    'src/sections/marketplace/catalog/server/product-engagement': {
      hasPurchasedProduct: async () => purchased,
      getProductEngagement: () => assert.fail('cart must not load reviews and engagement'),
      getProductPurchaseAccess: () => assert.fail('cart must not load detailed license access'),
    },
    'src/sections/marketplace/checkout/server/school-targets': { getEligibleLicenseSchools: () => assert.fail('cart must not query eligible schools') },
  };
  const exports = {};
  const source = readFileSync(new URL('../../src/app/api/marketplace/products/[id]/route.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, require: name => { assert.ok(mocks[name], name); return mocks[name]; },
  });
  return { GET: () => exports.GET({ url: 'https://example.test/product?view=cart' }, { params: Promise.resolve({ id: 'product' }) }), queries: () => queried };
}

test('cart refresh returns current price and cover without expensive detail lookups or private fields', async () => {
  const route = loadProduct({ resource_type: 'feature_unlock', license_scope: 'school' });
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.equal(response.body.product.price, 150);
  assert.equal(response.body.product.cover_url, '/cover.png');
  assert.equal(response.body.product.file_url, undefined);
  assert.equal(response.body.product.external_links, undefined);
  assert.equal(response.body.product.seller.owner_role, undefined);
  assert.equal(response.body.product.seller.is_system_store, true);
  assert.equal(route.queries(), 1);
});

test('cart refresh preserves product visibility and seller-tool restrictions', async () => {
  for (const overrides of [{ status: 'draft' }, { status: 'archived' }, { category: 'seller-tools' }, { resource_type: 'physical' }]) {
    assert.equal((await loadProduct(overrides).GET()).status, 404);
  }
});

test('previously purchased archived products remain visible for refresh', async () => {
  assert.equal((await loadProduct({ status: 'archived' }, { purchased: true }).GET()).status, 200);
});
