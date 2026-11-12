import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function load({ authorized = true, missingFunction = false } = {}) {
  const rows = [{ id: 'one', source: 'marketplace' }, { id: 'two', source: 'app' }];
  let calls = 0;
  const query = { select: () => query, order: () => query, range: () => query, then: resolve => resolve({ data: rows, count: 2 }) };
  const mocks = {
    bcryptjs: {},
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/auth-token': { requireRole: () => authorized ? { sub: 'admin' } : null },
    'src/lib/security-audit': { writeSecurityAudit: async () => {} },
    'src/lib/staff-supabase-auth': {},
    'src/lib/supabase-admin': { supabaseAdmin: {
      from: () => { calls++; return query; },
      rpc: async (name, args) => {
        calls++;
        assert.equal(name, 'system_account_registration_channels');
        assert.equal(args.app_ids.join(','), 'two');
        assert.equal(args.marketplace_ids.join(','), 'one');
        return missingFunction ? { error: { code: 'PGRST202' } } : { data: [{ id: 'one', source: 'marketplace', signup_channel: 'google' }, { id: 'two', source: 'app', signup_channel: 'email' }] };
      },
    } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/app/api/admin/system-users/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, {
    exports, URL, require: name => { assert.ok(mocks[name], name); return mocks[name]; },
  });
  return { ...exports, calls: () => calls };
}

test('registration channels are joined to current-page accounts in one batch', async () => {
  const route = load();
  const result = await route.GET({ url: 'https://example.test/users' });
  assert.equal(result.status, 200);
  assert.equal(result.body.accounts[0].signup_channel, 'google');
  assert.equal(result.body.accounts[1].signup_channel, 'email');
  assert.equal(route.calls(), 2);
});
test('missing migration leaves the table usable and explains unavailable channels', async () => {
  const result = await load({ missingFunction: true }).GET({ url: 'https://example.test/users' });
  assert.equal(result.status, 200);
  assert.equal(result.body.accounts[0].signup_channel, 'unknown');
  assert.match(result.body.signupChannelsWarning, /migration/);
});
test('non-admin requests cannot read registration channels', async () => {
  const route = load({ authorized: false });
  assert.equal((await route.GET({})).status, 403);
  assert.equal(route.calls(), 0);
});
