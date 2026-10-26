import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import crypto from 'node:crypto';
import ts from 'typescript';

function loadModule(file, mocks = {}, env = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, Buffer, URL, Date, process: { env },
    require: (name) => {
      if (name === 'server-only') return {};
      if (name === 'node:crypto') return crypto;
      assert.ok(mocks[name], `Unexpected dependency ${name}`);
      return mocks[name];
    },
  });
  return exports;
}
const env = { MARKETPLACE_SSO_SECRET: 'x'.repeat(32), EKRU_SSO_CALLBACK_URL: 'https://e-kru.com/auth/marketplace/callback', NEXT_PUBLIC_EKRU_URL: 'https://e-kru.com' };
const helper = loadModule('src/lib/marketplace-sso.ts', {}, env);

test('SSO enforces callback origin and a strong configured client secret', () => {
  assert.equal(helper.ssoConfig().callback, env.EKRU_SSO_CALLBACK_URL);
  for (const overrides of [ { MARKETPLACE_SSO_SECRET: 'short' }, { EKRU_SSO_CALLBACK_URL: 'https://attacker.example/callback' }, { EKRU_SSO_CALLBACK_URL: 'http://e-kru.com/callback' } ]) {
    assert.throws(() => loadModule('src/lib/marketplace-sso.ts', {}, { ...env, ...overrides }).ssoConfig());
  }
  assert.equal(helper.validSsoClient(new Request('https://example.com', { headers: { authorization: `Bearer ${env.MARKETPLACE_SSO_SECRET}` } }), env.MARKETPLACE_SSO_SECRET), true);
  assert.equal(helper.validSsoClient(new Request('https://example.com'), env.MARKETPLACE_SSO_SECRET), false);
});

test('SSO uses the RFC7636 S256 test vector and rejects malformed verifiers', () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  assert.equal(helper.ssoChallenge(verifier), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  assert.equal(helper.validSsoVerifier(verifier), true);
  assert.equal(helper.validSsoVerifier('short'), false);
});

test('SSO exchange consumes a code once and rechecks the active account', async () => {
  let stored = { sub: 'member', role: 'marketplace_user' };
  const module = loadModule('src/app/api/sso/exchange/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/marketplace-sso': helper,
    'src/lib/auth-rate-limit': { isActionAllowed: async () => true },
    'src/lib/auth-token': { isActiveTokenAccount: async () => true },
    'src/lib/supabase-admin': { supabaseAdmin: {
      rpc: async (name, args) => {
        assert.equal(name, 'consume_marketplace_sso_code');
        assert.equal(args.p_challenge, helper.ssoChallenge('v'.repeat(43)));
        const data = stored; stored = null; return { data };
      },
      from: () => { const q = { select: () => q, eq: () => q, single: async () => ({ data: { id: 'member', auth_user_id: null } }) }; return q; },
    } },
  });
  const request = () => new Request('https://e-kru-marketplace.com/api/sso/exchange', { method: 'POST', headers: { authorization: `Bearer ${env.MARKETPLACE_SSO_SECRET}` }, body: JSON.stringify({ code: 'c'.repeat(43), code_verifier: 'v'.repeat(43), redirect_uri: env.EKRU_SSO_CALLBACK_URL }) });
  const first = await module.POST(request());
  assert.equal(first.status, 200);
  assert.equal(first.body.subject, 'marketplace_users:member');
  assert.equal(first.body.auth_user_id, null);
  assert.equal((await module.POST(request())).status, 401);
});
