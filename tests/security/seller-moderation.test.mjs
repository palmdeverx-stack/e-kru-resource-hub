import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as z from 'zod';

function fixture(options = {}) {
  const seller = { id: 'seller', status: 'active', is_hidden: false, owner_role: 'marketplace_user', ...options.seller };
  const writes = []; const audits = []; const invalidations = [];
  let update; const predicates = {};
  const query = {
    select: () => query,
    eq: (key, value) => { predicates[key] = value; return query; },
    update: value => { update = value; return query; },
    maybeSingle: async () => {
      if (!update) return { data: options.missing ? null : { ...seller }, error: null };
      if (options.conflict) return { data: null, error: null };
      writes.push({ update, predicates: { ...predicates } });
      return { data: { id: seller.id }, error: null };
    },
  };
  const mocks = {
    zod: z,
    'next/cache': { revalidatePath: () => {}, revalidateTag: (...args) => invalidations.push(args) },
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } },
    'src/lib/auth-token': {
      requireRole: (_request, roles) => roles.includes(options.role ?? 'master_admin') ? { sub: 'admin' } : null,
      isActiveTokenAccount: async () => !options.revoked,
    },
    'src/lib/request-security': { rejectCrossSiteMutation: () => options.csrf ? { status: 403 } : null },
    'src/lib/security-audit': { writeSecurityAudit: async event => audits.push(event) },
    'src/lib/supabase-admin': { supabaseAdmin: { from: () => query } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/app/api/marketplace/admin/seller-accounts/[id]/moderation/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: name => { assert.ok(mocks[name], name); return mocks[name]; },
  });
  return { writes, audits, invalidations, run: (action, reason = 'เหตุผลการตรวจสอบ') => exports.PATCH({ json: async () => ({ action, reason }) }, { params: Promise.resolve({ id: 'seller' }) }) };
}

for (const options of [{ role: 'teacher' }, { role: 'marketplace_admin' }, { revoked: true }, { csrf: true }]) {
  test(`moderation rejects unauthorized request ${JSON.stringify(options)}`, async () => {
    const f = fixture(options); assert.equal((await f.run('hide')).status, 403); assert.equal(f.writes.length, 0);
  });
}
for (const [action, seller, status, hidden] of [
  ['hide', {}, 'active', true], ['show', { is_hidden: true }, 'active', false],
  ['suspend', { is_hidden: true }, 'suspended', true],
  ['restore', { status: 'suspended', is_hidden: true }, 'active', true],
]) {
  test(`${action} preserves independent approval/visibility state and audits the change`, async () => {
    const f = fixture({ seller }); assert.equal((await f.run(action)).status, 200);
    assert.equal(f.writes[0].update.status, status); assert.equal(f.writes[0].update.is_hidden, hidden);
    assert.equal(f.audits[0].action, `marketplace.seller_${action}`);
    assert.equal(f.invalidations[0][0], 'public-store-directory');
    assert.equal(f.writes[0].predicates.status, seller.status ?? 'active');
  });
}
test('invalid actions, missing reasons, system stores and invalid transitions never write', async () => {
  for (const [options, action, reason, expected] of [
    [{}, 'delete', 'reason', 400], [{}, 'hide', ' ', 400], [{}, 'hide', 'a'.repeat(1001), 400],
    [{ seller: { owner_role: 'master_admin' } }, 'hide', 'reason', 403],
    [{ seller: { status: 'pending' } }, 'restore', 'reason', 409],
    [{ conflict: true }, 'suspend', 'reason', 409], [{ missing: true }, 'hide', 'reason', 404],
  ]) {
    const f = fixture(options); assert.equal((await f.run(action, reason)).status, expected); assert.equal(f.writes.length, 0);
  }
});
