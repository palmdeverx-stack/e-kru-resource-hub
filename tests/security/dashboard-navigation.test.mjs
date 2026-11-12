import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function load(role, status = 'active') {
  const calls = [];
  const exports = {};
  const rows = {
    marketplace_sellers: { status },
    marketplace_referral_settings: { is_enabled: true },
    marketplace_line_settings: { allow_seller_notifications: false },
  };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/auth-token': { requireAuthenticated: () => role ? { sub: 'owner', role } : null },
    'src/lib/supabase-admin': { supabaseAdmin: { from: table => {
      const q = { select: columns => { calls.push({ table, columns }); return q; }, eq: () => q,
        maybeSingle: async () => ({ data: rows[table], error: null }) };
      return q;
    } } },
    'src/sections/marketplace/shipping/server/config': { getMarketplaceShippingConfig: async () => ({ enabled: false, officialAccessEnabled: true }) },
  };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/app/api/marketplace/navigation/route.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => mocks[name] });
  return { ...exports, calls };
}

test('navigation returns only menu flags and respects seller and feature status', async () => {
  const api = load('marketplace_user');
  const { body } = await api.GET({});
  assert.equal(body.hasSubmittedSeller, true);
  assert.equal(body.referralEnabled, true);
  assert.equal(body.canUseSellerLine, false);
  assert.equal(body.shippingEnabled, false);
  assert.equal((await load('marketplace_user', 'draft').GET({})).body.hasSubmittedSeller, false);
  assert.equal(api.calls.length, 3);
  assert.ok(api.calls.every(x => !x.columns.includes('*') && !x.columns.includes(':')));
});

test('admin menu skips member queries and unauthenticated requests are rejected', async () => {
  const admin = load('master_admin');
  const { body } = await admin.GET({});
  assert.equal(body.hasSubmittedSeller, true);
  assert.equal(body.canUseSellerLine, true);
  assert.equal(body.referralEnabled, false);
  assert.equal(admin.calls.length, 0);
  const guest = load(null);
  assert.equal((await guest.GET({})).status, 401);
  assert.equal(guest.calls.length, 0);
});
