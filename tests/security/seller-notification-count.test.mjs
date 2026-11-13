import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture(allowed = true) {
  const calls = [];
  const query = {
    select: (...args) => { calls.push(['select', ...args]); return query; },
    neq: (...args) => { calls.push(['neq', ...args]); return query; },
    or: (...args) => { calls.push(['or', ...args]); return query; },
    then: resolve => resolve({ count: 7, error: null }),
  };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    'src/lib/auth-token': { requireRole: () => allowed },
    'src/lib/supabase-admin': { supabaseAdmin: { from: () => { calls.push(['from']); return query; } } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/app/api/marketplace/admin/sellers/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, URL, require: name => { assert.ok(mocks[name]); return mocks[name]; } });
  return { calls, run: suffix => exports.GET({ url: 'https://example.test/api/marketplace/admin/sellers?notification=1' + suffix }) };
}

test('header notification performs one count-only query and excludes official stores', async () => {
  const f = fixture(); const result = await f.run('');
  assert.equal(result.body.unreadCount, 7);
  assert.equal(f.calls.filter(c => c[0] === 'from').length, 1);
  assert.equal(f.calls.find(c => c[0] === 'select')[2].head, true);
  assert.ok(f.calls.some(c => c[0] === 'neq' && c[1] === 'owner_role' && c[2] === 'master_admin'));
});
test('notification count remains restricted to admins', async () => {
  const f = fixture(false); assert.equal((await f.run('')).status, 403); assert.equal(f.calls.length, 0);
});
test('unread count covers both new applications and profile revisions after seen time', async () => {
  const f = fixture(); await f.run('&seenAt=1000');
  assert.ok(f.calls.some(c => c[0] === 'or' && c[1].includes('submitted_at.gt.1970-01-01T00:00:01.000Z') && c[1].includes('profile_submitted_at.gt.')));
});
