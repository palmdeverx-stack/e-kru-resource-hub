import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../../src/app/api/auth/line/route.ts', import.meta.url), 'utf8');

function handler({ identity = {}, caller = null, active = true, csrf = null } = {}) {
  const calls = [];
  const mocks = {
    'next/server': {
      after: () => {},
      NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) },
    },
    'src/lib/supabase-admin': { supabaseAdmin: { from: () => { calls.push('database'); throw new Error('Unexpected database access'); } } },
    'src/lib/auth-rate-limit': { isActionAllowed: async () => true },
    'src/lib/request-security': { rejectCrossSiteMutation: () => csrf },
    'src/lib/security-audit': { writeSecurityAudit: () => {} },
    'src/lib/auth-token': { requireAuthenticated: () => caller, isActiveTokenAccount: async () => active },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports,
    require: (name) => { assert.ok(mocks[name], `Unknown dependency ${name}`); return mocks[name]; },
    process: { env: { LINE_LOGIN_CHANNEL_ID: '123' } },
    URLSearchParams, AbortSignal,
    fetch: async () => ({ ok: true, json: async () => identity }),
  });
  return { post: exports.POST, calls };
}
const valid = { iss: 'https://access.line.me', aud: '123', sub: 'U123', exp: Date.now() / 1000 + 300 };
const request = (action = 'login') => ({ json: async () => ({ idToken: 'signed-token', action }) });

test('LINE rejects another channel, expired tokens, and forged issuer before account lookup', async () => {
  for (const identity of [{ ...valid, aud: 'attacker' }, { ...valid, exp: 0 }, { ...valid, iss: 'https://attacker.example' }]) {
    const { post, calls } = handler({ identity });
    assert.equal((await post(request())).status, 401);
    assert.deepEqual(calls, []);
  }
});

test('LINE linking requires an active Marketplace session', async () => {
  for (const options of [{}, { caller: { role: 'marketplace_user' }, active: false }, { caller: { role: 'school_admin' } }]) {
    const { post, calls } = handler({ identity: valid, ...options });
    assert.ok([401, 403].includes((await post(request('link'))).status));
    assert.deepEqual(calls, []);
  }
});

test('LINE blocks cross-site login requests before token verification', async () => {
  const { post, calls } = handler({ csrf: { status: 403 } });
  assert.equal((await post(request())).status, 403);
  assert.deepEqual(calls, []);
});
