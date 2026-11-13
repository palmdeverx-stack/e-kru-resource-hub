import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture(status, purchased = false) {
  let queries = 0, downloads = 0;
  const exports = {};
  const image = { id: 'image', product_id: 'product', storage_bucket: 'private', storage_path: 'image', mime_type: 'image/png', product: { id: 'product', status, seller: { owner_id: 'owner' } } };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    'src/lib/auth-token': { requireAuthenticated: request => request.caller },
    'src/sections/marketplace/catalog/server/product-engagement': { hasPurchasedProduct: async () => purchased },
    'src/lib/supabase-admin': { supabaseAdmin: {
      from: table => { assert.equal(table, 'marketplace_product_images'); queries++; const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: image }) }; return q; },
      storage: { from: () => ({ download: async () => { downloads++; return { data: new Blob(['image']) }; } }) },
    } },
  };
  const code = ts.transpileModule(readFileSync('src/app/api/marketplace/images/[imageId]/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, Response, require: name => { assert.ok(mocks[name], name); return mocks[name]; } });
  return { run: caller => exports.GET({ caller }, { params: Promise.resolve({ imageId: 'image' }) }), counts: () => ({ queries, downloads }) };
}

test('published purchase covers use one metadata query', async () => {
  const f = fixture('published'); assert.equal((await f.run(null)).status, 200);
  assert.deepEqual(f.counts(), { queries: 1, downloads: 1 });
});
test('unpublished covers are hidden from guests and unrelated users', async () => {
  for (const caller of [null, { sub: 'other', role: 'marketplace_user' }]) {
    const f = fixture('draft'); assert.equal((await f.run(caller)).status, 404);
    assert.equal(f.counts().downloads, 0);
  }
});
test('buyers retain access to unpublished purchased covers without public caching', async () => {
  const f = fixture('archived', true); const response = await f.run({ sub: 'buyer', role: 'marketplace_user' });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
});
test('owners and admins retain management access', async () => {
  for (const caller of [{ sub: 'owner', role: 'marketplace_user' }, { sub: 'admin', role: 'master_admin' }]) {
    assert.equal((await fixture('draft').run(caller)).status, 200);
  }
});
