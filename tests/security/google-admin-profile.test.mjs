import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture({ role = 'master_admin', suspended = false, verified = true, updateError = false, name = 'Google Admin', familyName = 'Admin' } = {}) {
  const writes = []; const pins = []; const signed = [];
  const user = { id: 'admin', auth_user_id: 'google-id', role, school_id: 'school', first_name: 'Old', last_name: 'Name', is_active: true, is_suspended: suspended };
  const authUser = {
    id: 'google-id', email: 'admin@example.test', email_confirmed_at: verified ? 'now' : null,
    app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Wrong source' },
    identities: [{ provider: 'google', identity_data: { full_name: name, given_name: name.split(' ')[0], family_name: familyName, picture: 'https://example.test/avatar.png' } }],
  };
  const mocks = {
    'next/server': { after: () => {}, NextResponse: { json: (body, init) => { const r = Response.json(body, init); r.cookies = { set: () => {} }; return r; } } },
    'src/lib/supabase-admin': { supabaseAdmin: {
      auth: { getUser: async () => ({ data: { user: authUser } }), admin: { updateUserById: async () => ({}) } },
      from: table => {
        let patch;
        const query = { select: () => query, eq: () => query, update: data => { patch = data; return query; },
          maybeSingle: async () => ({ data: table === 'app_users' ? user : table === 'schools' ? { is_active: true } : null }),
          then: resolve => { if (patch) writes.push(patch); resolve({ error: updateError ? { message: 'failed' } : null }); },
        }; return query;
      },
    } },
    'src/lib/security-audit': { writeSecurityAudit: async () => {} },
    'src/lib/request-security': { rejectCrossSiteMutation: () => null },
    'src/lib/school-subscription': { loadSchoolSubscription: async () => ({}), isSubscriptionUsable: () => true },
    'src/lib/auth-token': { toPublicUser: u => u, signAppToken: u => { signed.push(u); return 'token'; }, signPinChallenge: id => { pins.push(id); return 'challenge'; }, ACCESS_TOKEN_COOKIE: 'session', accessTokenCookieOptions: {} },
    'src/sections/marketplace/admin/server/line-notifications': { notifyMarketplaceMemberRegistered: () => assert.fail('must not notify for existing admin') },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/app/api/auth/google/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, Response, URL, require: name => { assert.ok(mocks[name], name); return mocks[name]; },
  });
  return { writes, pins, signed, run: () => exports.POST(new Request('https://example.test/api/auth/google', { method: 'POST', headers: { authorization: 'Bearer verified-by-server' } })) };
}

test('verified Google admin identity updates display fields and still requires PIN', async () => {
  const f = fixture(); const r = await f.run(); const body = await r.json();
  assert.equal(r.status, 200); assert.equal(body.requiresPin, true);
  assert.equal(f.writes[0].first_name, 'Google'); assert.equal(f.writes[0].last_name, 'Admin');
  assert.equal(f.writes[0].role, undefined); assert.equal(f.writes[0].email, undefined);
  assert.equal(f.signed.length, 0); assert.equal(f.pins.length, 1);
});
test('marketplace admin receives Google name in authenticated response', async () => {
  const f = fixture({ role: 'marketplace_admin', name: 'Palmer Dever', familyName: 'Dever' }); const r = await f.run();
  assert.equal((await r.json()).user.first_name, 'Palmer'); assert.equal(f.signed.length, 1);
});
test('single-word Google names do not acquire a fabricated surname', async () => {
  const f = fixture({ name: 'Palmer', familyName: '' }); await f.run(); assert.equal(f.writes[0].last_name, '');
});
test('school-managed names are preserved', async () => {
  const f = fixture({ role: 'school_admin' }); const r = await f.run(); assert.equal(r.status, 200); assert.equal(f.writes.length, 0);
});
for (const options of [{ suspended: true }, { verified: false }]) {
  test(`invalid Google login cannot update admin profile ${JSON.stringify(options)}`, async () => {
    const f = fixture(options); assert.ok((await f.run()).status >= 400); assert.equal(f.writes.length, 0); assert.equal(f.pins.length, 0);
  });
}
test('profile write failure does not issue an authenticated session', async () => {
  const f = fixture({ updateError: true, name: 'Palmer Dever' }); assert.equal((await f.run()).status, 500); assert.equal(f.signed.length, 0); assert.equal(f.pins.length, 0);
});
