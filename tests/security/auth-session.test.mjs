import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function loadModule(file, mocks = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports, URL, Buffer, console, process: { env: { AUTH_JWT_SECRET: 'test-secret-only' } },
    require: name => {
      if (name === 'server-only') return {};
      if (name === 'src/lib/api-fetch') return { apiFetch: (...args) => { assert.ok(globals.fetch, 'Mock fetch is required'); return globals.fetch(...args); }, setApiCacheScope: () => {} };
      assert.ok(mocks[name], `Unexpected dependency ${name}`);
      return mocks[name];
    },
    ...globals,
  });
  return exports;
}

const jsonResponse = (body, options = {}) => ({ body, status: options.status ?? 200, headers: options.headers });

test('concurrent account checks share one lookup but recheck suspension and session revocation afterwards', async () => {
  let reads = 0;
  let account = { role: 'teacher', school_id: 'school', is_active: true, session_version: 1 };
  const auth = loadModule('src/lib/auth-token.ts', {
    jsonwebtoken: {},
    'src/lib/supabase-admin': { supabaseAdmin: { from: () => {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => {
        reads++;
        await Promise.resolve();
        return { data: account, error: null };
      } };
      return query;
    } } },
  });
  const payload = { sub: 'user', role: 'teacher', schoolId: 'school', sessionVersion: 1 };
  const result = await Promise.all(Array.from({ length: 10 }, () => auth.isActiveTokenAccount(payload)));
  assert.ok(result.every(Boolean));
  assert.equal(reads, 1);
  account = { ...account, is_suspended: true };
  assert.equal(await auth.isActiveTokenAccount(payload), false);
  assert.equal(reads, 2);
  account = { ...account, is_suspended: false, session_version: 2 };
  assert.equal(await auth.isActiveTokenAccount(payload), false);
  account = null;
  assert.equal(await auth.isActiveTokenAccount({ ...payload, role: 'marketplace_user' }), false);
});

test('/me independently rejects deleted, suspended, revoked, role-changed and school-changed accounts', async () => {
  const payload = { sub: 'user', role: 'teacher', schoolId: 'school', sessionVersion: 2 };
  let account;
  const route = loadModule('src/app/api/auth/me/route.ts', {
    'next/server': { NextResponse: { json: jsonResponse } },
    'src/lib/auth-token': { getRequestToken: () => 'cookie', verifyAppToken: () => payload, toPublicUser: user => ({ id: user.id, role: user.role }) },
    'src/lib/department-permission-access': { getDepartmentSessionPermissions: async () => ({ view: [], manage: [] }) },
    'src/lib/supabase-admin': { supabaseAdmin: { from: () => {
      const query = { select: () => query, eq: () => query, single: async () => ({ data: account }), then: resolve => resolve({ data: [] }) };
      return query;
    } } },
  });
  const valid = { id: 'user', role: 'teacher', school_id: 'school', is_active: true, session_version: 2 };
  for (const invalid of [null, { ...valid, is_active: false }, { ...valid, is_suspended: true }, { ...valid, session_version: 3 }, { ...valid, role: 'master_admin' }, { ...valid, school_id: 'other' }]) {
    account = invalid;
    assert.equal((await route.GET({})).status, 401);
  }
  account = valid;
  const response = await route.GET({});
  assert.equal(response.status, 200);
  assert.equal(response.headers['Cache-Control'], 'private, no-store');
});

test('logout clears the cookie before running deferred audit and still rejects cross-site requests', async () => {
  let crossSite = false;
  let audits = 0;
  let deleted;
  const deferred = [];
  const route = loadModule('src/app/api/auth/sign-out/route.ts', {
    'next/server': { after: task => deferred.push(task), NextResponse: { json: body => ({ body, cookies: { delete: name => { deleted = name; } } }) } },
    'src/lib/security-audit': { writeSecurityAudit: async () => { audits++; } },
    'src/lib/request-security': { rejectCrossSiteMutation: () => crossSite ? { status: 403 } : null },
    'src/lib/auth-token': { ACCESS_TOKEN_COOKIE: 'access_token', requireAuthenticated: () => null },
  });
  const response = await route.POST({});
  assert.equal(response.body.success, true);
  assert.equal(deleted, 'access_token');
  assert.equal(audits, 0);
  await deferred[0]();
  assert.equal(audits, 1);
  crossSite = true;
  assert.equal((await route.POST({})).status, 403);
  assert.equal(deferred.length, 1);
});

test('a delayed /me response cannot overwrite a newer login or logout', async () => {
  let complete;
  let requests = 0;
  let clears = 0;
  const updates = [];
  const provider = loadModule('src/auth/context/jwt/auth-provider.tsx', {
    react: { useRef: value => ({ current: value }), useCallback: fn => fn, useEffect: () => {}, useMemo: fn => fn() },
    'react/jsx-runtime': { jsx: (_type, props) => props },
    'minimal-shared/hooks': { useSetState: () => ({ state: { user: null, loading: true }, setState: state => updates.push(state) }) },
    '@tanstack/react-query': { useQueryClient: () => ({ clear: () => clears++ }) },
    '../auth-context': { AuthContext: {} },
  }, { fetch: () => { requests++; return new Promise(resolve => { complete = resolve; }); } });
  const context = provider.AuthProvider({ children: null }).value;
  const first = context.checkUserSession();
  assert.equal(context.checkUserSession(), first);
  assert.equal(requests, 1);
  context.setSessionUser({ id: 'new-user' });
  complete({ ok: true, json: async () => ({ user: { id: 'old-user' } }) });
  await first;
  assert.equal(updates.length, 1);
  assert.equal(updates[0].user.id, 'new-user');
  const second = context.checkUserSession();
  context.setSessionUser(null);
  complete({ ok: true, json: async () => ({ user: { id: 'new-user' } }) });
  await second;
  assert.equal(updates.at(-1).user, null);
  assert.equal(updates.length, 2);
  assert.equal(clears, 2);
});

test('batched session permissions match existing view/manage rules with overrides', async () => {
  const config = loadModule('src/lib/department-permissions-config.ts');
  const datasets = {
    department_members: { id: 'member', department_id: 'department', department: { school_id: 'school' } },
    app_users: { staff_type: 'academic' },
    staff_type_permissions: [{ permission_key: 'grades.review', access_level: 'view' }],
    staff_permission_overrides: [{ permission_key: 'grades.approve', access_level: 'none' }],
    department_permissions: [{ permission_key: 'grades.review' }, { permission_key: 'grades.approve' }],
    department_member_permissions: [{ permission_key: 'grades.approve' }],
  };
  let queries = 0;
  const permissions = loadModule('src/lib/department-permission-access.ts', {
    './department-permissions-config': config,
    './supabase-admin': { supabaseAdmin: { from: table => {
      queries++;
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: datasets[table] }), then: resolve => resolve({ data: datasets[table] }) };
      return query;
    } } },
  });
  const oldView = await permissions.getDepartmentGrantedPermissions('teacher', 'school');
  const oldManage = await permissions.getEffectiveDepartmentPermissions('teacher', 'school');
  const oldQueries = queries;
  queries = 0;
  const combined = await permissions.getDepartmentSessionPermissions('teacher', 'school');
  assert.equal(JSON.stringify(combined.view), JSON.stringify(oldView));
  assert.equal(JSON.stringify(combined.manage), JSON.stringify(oldManage));
  assert.ok(queries < oldQueries);
  assert.equal(queries, 6);
});

test('logout without a Supabase browser session makes only the application logout request', async () => {
  let requests = 0;
  const action = loadModule('src/auth/context/jwt/action.ts', {
    'src/global-config': { CONFIG: { supabase: { url: 'https://test-project.supabase.co' } } },
  }, {
    window: { localStorage: { getItem: key => { assert.equal(key, 'sb-test-project-auth-token'); return null; } } },
    fetch: async (url, options) => {
      requests++;
      assert.equal(url, '/api/auth/sign-out');
      assert.equal(options.method, 'POST');
      return { ok: true };
    },
  });
  await action.signOut();
  assert.equal(requests, 1);
});

for (const scenario of ['hanging', 'failure', 'success']) {
  test(`logout finishes and clears persisted OAuth credentials when optional SDK cleanup is ${scenario}`, async () => {
    const removed = [];
    let releaseTimeout;
    const action = loadModule('src/auth/context/jwt/action.ts', {
      'src/global-config': { CONFIG: { supabase: { url: 'https://test-project.supabase.co' } } },
      'src/lib/supabase-browser': { getSupabaseBrowserClient: () => ({ auth: { signOut: async () => {
        if (scenario === 'hanging') await new Promise(() => {});
        if (scenario === 'failure') throw new Error('fixture');
      } } }) },
    }, {
      window: { localStorage: { getItem: () => 'fixture-session', removeItem: key => removed.push(key) } },
      setTimeout: (callback, ms) => { assert.equal(ms, 1500); releaseTimeout = callback; return 1; },
      clearTimeout: () => {},
      fetch: async () => ({ ok: true }),
    });
    const pending = action.signOut();
    await new Promise(resolve => setImmediate(resolve));
    if (scenario === 'hanging') releaseTimeout();
    await pending;
    assert.ok(removed.includes('sb-test-project-auth-token'));
    assert.ok(removed.includes('sb-test-project-auth-token-code-verifier'));
  });
}

test('a rejected application logout does not clear optional credentials or report success', async () => {
  const action = loadModule('src/auth/context/jwt/action.ts', {
    'src/global-config': { CONFIG: { supabase: { url: 'https://test-project.supabase.co' } } },
  }, {
    window: { localStorage: { removeItem: () => assert.fail('Failed logout must not report local success') } },
    fetch: async () => ({ ok: false }),
  });
  await assert.rejects(action.signOut());
});
