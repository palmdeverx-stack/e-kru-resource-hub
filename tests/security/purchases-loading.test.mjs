import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function loadOrders({ summary = true, authorized = true, error = null } = {}) {
  const product = { id: 'product', title: 'Resource', images: [], files: [{ id: 'download-file', scan_status: 'clean' }], file_url: '/legacy-file' };
  const orders = [
    { id: 'paid', status: 'paid', seller: { owner_role: 'master_admin' }, items: [{ id: 'item1', product }] },
    { id: 'pending', status: 'pending_payment', seller: { owner_role: 'master_admin' }, items: [{ id: 'item2', product }] },
    { id: 'other', status: 'completed', seller: { owner_role: 'master_admin' }, items: [{ id: 'item3', product: { ...product, id: 'other-product' } }] },
  ];
  let mediaCalls = 0;
  let fallbackCalls = 0;
  let selected = '';
  const query = {
    select: columns => { selected = columns; return query; },
    eq: (column, value) => { assert.equal(column, 'buyer_id'); assert.equal(value, 'buyer'); return query; },
    order: () => query,
    returns: async () => ({ data: orders.map(order => ({ ...order, items: order.items.map(item => {
      if (!summary) return item;
      const { files, file_url, ...safeProduct } = item.product;
      return { ...item, product: safeProduct };
    }) })), error }),
  };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/auth-token': { requireAuthenticated: () => authorized ? { sub: 'buyer' } : null },
    'src/lib/supabase-admin': { supabaseAdmin: { from: table => { assert.equal(table, 'marketplace_orders'); return query; } } },
    'src/sections/marketplace/seller/server/public-seller': { withPublicSystemStoreFlag: seller => seller },
    'src/sections/marketplace/seller/server/product-media': {
      withMediaUrls: async (product, options) => { mediaCalls++; return { ...product, cover_url: await options.officialCoverFallback() }; },
      getOfficialProductCoverFallback: async () => { fallbackCalls++; return '/fallback.png'; },
      withoutFileScanMetadata: file => { const { scan_status, ...rest } = file; return rest; },
    },
  };
  const source = readFileSync(new URL('../../src/app/api/marketplace/orders/route.ts', import.meta.url), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, performance, require: name => mocks[name] ?? {},
  });
  return { GET: exports.GET, stats: () => ({ selected, mediaCalls, fallbackCalls }) };
}

test('purchase list omits download metadata and shares image work across repeated products', async () => {
  const route = loadOrders();
  const response = await route.GET({ url: 'https://example.test/orders?summary=1' });
  assert.equal(response.status, 200);
  assert.equal(response.body.orders.length, 3);
  for (const order of response.body.orders) {
    assert.equal(order.items[0].product.cover_url, '/fallback.png');
    assert.equal(order.items[0].product.files, undefined);
    assert.equal(order.items[0].product.file_url, undefined);
  }
  const { selected, mediaCalls, fallbackCalls } = route.stats();
  assert.ok(!selected.includes('marketplace_product_files'));
  assert.ok(!selected.includes('file_url'));
  assert.equal(mediaCalls, 2);
  assert.equal(fallbackCalls, 1);
});

test('full orders retain paid download links and hide downloads for unpaid purchases', async () => {
  const response = await loadOrders({ summary: false }).GET({ url: 'https://example.test/orders' });
  assert.match(response.body.orders[0].items[0].product.files[0].url, /orderItemId=item1/);
  assert.equal(response.body.orders[0].items[0].product.files[0].scan_status, undefined);
  assert.equal(response.body.orders[1].items[0].product.file_url, null);
  assert.equal(response.body.orders[1].items[0].product.files.length, 0);
});

test('purchase loading still requires authentication and propagates database errors', async () => {
  assert.equal((await loadOrders({ authorized: false }).GET({})).status, 401);
  assert.equal((await loadOrders({ error: { message: 'unavailable' } }).GET({ url: 'https://example.test/orders?summary=1' })).status, 500);
});
