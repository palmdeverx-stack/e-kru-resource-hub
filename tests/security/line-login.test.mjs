import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../../src/app/api/auth/line/route.ts', import.meta.url), 'utf8');

function handler({ identity = {}, caller = null, active = true, csrf = null, linkedUser, fetchImpl, unlinked = false, rpcImpl } = {}) {
  const calls = [];
  const mocks = {
    'next/server': {
      after: () => {},
      NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200, cookies: { set: (...args) => calls.push(args) }, headers: new Headers() }) },
    },
    'src/lib/supabase-admin': { supabaseAdmin: { rpc: (...args) => { calls.push('register'); return rpcImpl(...args); }, from: (table) => {
      if (!linkedUser) { calls.push('database'); throw new Error('Unexpected database access'); }
      const query = {
        select: () => query, eq: () => query,
        maybeSingle: async () => ({ data: unlinked ? null : { user_id: linkedUser.id } }),
        single: async () => ({ data: linkedUser }),
      };
      assert.ok(['marketplace_line_identities', 'marketplace_users'].includes(table));
      return query;
    } } },
    'src/lib/auth-rate-limit': { isActionAllowed: async () => true },
    'src/lib/request-security': { rejectCrossSiteMutation: () => csrf },
    'src/sections/marketplace/admin/server/line-notifications': { notifyMarketplaceMemberRegistered: async () => {} },
    'src/lib/security-audit': { writeSecurityAudit: () => {} },
    'src/lib/auth-token': { ACCESS_TOKEN_COOKIE: 'access_token', accessTokenCookieOptions: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
      signAppToken: () => 'signed-app-token', toPublicUser: (user) => user, requireAuthenticated: () => caller, isActiveTokenAccount: async () => active },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports,
    require: (name) => { assert.ok(mocks[name], `Unknown dependency ${name}`); return mocks[name]; },
    process: { env: { LINE_LOGIN_CHANNEL_ID: '123' } },
    URLSearchParams, AbortSignal,
    fetch: fetchImpl ?? (async () => ({ ok: true, json: async () => identity })),
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


test('linked LINE login issues the E-KRU session cookie; disabled accounts receive none', async () => {
  const user = { id: 'member-1', username: 'member', is_active: true, is_suspended: false };
  const { post, calls } = handler({ identity: valid, linkedUser: user });
  const response = await post(request());
  assert.equal(response.status, 200);
  assert.equal(response.body.user.id, user.id);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(calls[0][0], 'access_token');
  assert.equal(calls[0][1], 'signed-app-token');
  assert.equal(calls[0][2].httpOnly, true);
  for (const blocked of [{ ...user, is_active: false }, { ...user, is_suspended: true }]) {
    const run = handler({ identity: valid, linkedUser: blocked });
    assert.equal((await run.post(request())).status, 403);
    assert.deepEqual(run.calls, []);
  }
});


test('access token fallback verifies channel and expiry before reading LINE profile', async () => {
  for (const token of [{ client_id: 'attacker', expires_in: 100 }, { client_id: '123', expires_in: 0 }]) {
    let requests = 0;
    const run = handler({ fetchImpl: async () => { requests++; return { ok: true, json: async () => token }; } });
    assert.equal((await run.post({ json: async () => ({ accessToken: 'access', action: 'login' }) })).status, 401);
    assert.equal(requests, 1);
    assert.deepEqual(run.calls, []);
  }
  const urls = [];
  const run = handler({
    linkedUser: { id: 'member', username: 'member', is_active: true },
    fetchImpl: async (url, options) => {
      urls.push(url);
      if (url.includes('/verify?')) return { ok: true, json: async () => ({ client_id: '123', expires_in: 300 }) };
      assert.equal(options.headers.Authorization, 'Bearer access');
      return { ok: true, json: async () => ({ userId: 'U123' }) };
    },
  });
  const result = await run.post({ json: async () => ({ idToken: null, accessToken: 'access', action: 'login' }) });
  assert.equal(result.status, 200);
  assert.equal(urls[1], 'https://api.line.me/v2/profile');
  assert.equal(run.calls[0][0], 'access_token');
});


test('new LINE member must explicitly accept terms before atomic registration', async () => {
  const body = { idToken: 'signed-token', action: 'register', firstName: 'New', lastName: 'Member', acceptedTerms: true };
  const member = { id: 'new-member', username: 'line_new', is_active: true };
  for (const invalid of [{ acceptedTerms: false }, { firstName: '' }, { lastName: 'x'.repeat(101) }]) {
    const run = handler({ identity: valid, linkedUser: member, unlinked: true });
    assert.equal((await run.post({ json: async () => ({ ...body, ...invalid }) })).status, 400);
    assert.deepEqual(run.calls, []);
  }
  const run = handler({ identity: valid, linkedUser: member, unlinked: true,
    rpcImpl: async (name, args) => {
      assert.equal(name, 'register_marketplace_line_member');
      assert.equal(args.p_subject, valid.sub);
      assert.equal(args.p_channel_id, valid.aud);
      assert.equal(args.p_first_name, 'New');
      return { data: member.id };
    },
  });
  const result = await run.post({ json: async () => body });
  assert.equal(result.status, 200);
  assert.equal(result.body.user.id, member.id);
  assert.equal(run.calls[0], 'register');
  assert.equal(run.calls[1][0], 'access_token');
});

test('existing LINE member is reused without registering a duplicate', async () => {
  const run = handler({ identity: valid, linkedUser: { id: 'existing', username: 'member', is_active: true } });
  const result = await run.post({ json: async () => ({ idToken: 'signed-token', action: 'register' }) });
  assert.equal(result.status, 200);
  assert.equal(result.body.user.id, 'existing');
  assert.ok(!run.calls.includes('register'));
});

test('new LINE identity prompts registration without silently creating an account', async () => {
  const run = handler({ identity: valid, linkedUser: { id: 'unused' }, unlinked: true });
  const result = await run.post(request());
  assert.equal(result.status, 409);
  assert.equal(result.body.needsRegistration, true);
  assert.deepEqual(run.calls, []);
});
