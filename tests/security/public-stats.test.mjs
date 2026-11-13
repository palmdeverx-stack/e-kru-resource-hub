import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: name => { if (name === 'server-only') return {}; assert.ok(mocks[name], name); return mocks[name]; },
  });
  return exports;
}

function statsFixture(failedTable) {
  const counts = { app_users: 12, marketplace_products: 24, schools: 4, marketplace_users: 65, marketplace_sellers: 3, marketplace_orders: 8 };
  const filters = [];
  const helper = load('src/sections/marketplace/catalog/server/public-stats.ts', {
    'next/cache': { unstable_cache: fn => fn },
    'src/lib/supabase-admin': { supabaseAdmin: { from(table) {
      const query = {
        select(_columns, options) { assert.equal(options.head, true); assert.equal(options.count, 'exact'); return query; },
        eq(key, value) { filters.push([table, key, value]); return query; },
        in(key, value) { filters.push([table, key, [...value]]); return query; },
        then(resolve) { resolve({ count: counts[table], error: table === failedTable ? { message: 'database failure fixture' } : null }); },
      };
      return query;
    } } },
  });
  const route = load('src/app/api/marketplace/public-stats/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200, headers: options.headers }) } },
    'src/sections/marketplace/catalog/server/public-stats': helper,
  });
  return { route, helper, filters };
}

test('landing statistics preserve active/published/paid filters and return only aggregate public counts', async () => {
  const { route, filters } = statsFixture();
  const result = await route.GET();
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(result.body)), { teachers: 12, products: 24, schools: 4, externalMembers: 65, activeSellers: 3, completedOrders: 8, updatedAt: result.body.updatedAt });
  assert.ok(Number.isFinite(Date.parse(result.body.updatedAt)));
  assert.ok(filters.some(([table, column, value]) => table === 'app_users' && column === 'is_active' && value === true));
  assert.ok(filters.some(([table, column, value]) => table === 'marketplace_products' && column === 'status' && value === 'published'));
  assert.ok(filters.some(([table, column, value]) => table === 'marketplace_orders' && column === 'status' && value.join(',') === 'paid,completed'));
  assert.equal(result.headers['Cache-Control'], 'public, s-maxage=300, stale-while-revalidate=600');
});

test('statistics failures do not become cached zero counts or expose database error details', async () => {
  const { route, helper } = statsFixture('schools');
  await assert.rejects(helper.getPublicMarketplaceStats());
  const response = await route.GET();
  assert.equal(response.status, 503);
  assert.equal(response.body.schools, undefined);
  assert.ok(!JSON.stringify(response.body).includes('database failure fixture'));
  assert.equal(response.headers?.['Cache-Control'], undefined);
});
