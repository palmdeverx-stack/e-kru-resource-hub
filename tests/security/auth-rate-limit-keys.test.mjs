import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function fixture({ unavailable = false } = {}) {
  const calls = [], attempts = new Map();
  const exports = {};
  const code = ts.transpileModule(readFileSync('src/lib/auth-rate-limit.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, {
    exports, console: { error() {} },
    require(name) {
      if (name === 'server-only') return {};
      if (name === 'node:crypto') return { createHash };
      if (name === 'src/lib/supabase-admin') return { supabaseAdmin: { rpc: async (_name, args) => {
        calls.push(args);
        if (unavailable) return { error: { code: 'fixture' }, data: null };
        // Match production's actual 100-character boundary and attempt counting.
        if (args.p_identifier.length > 100) return { data: false };
        const count = (attempts.get(args.p_identifier) ?? 0) + 1;
        attempts.set(args.p_identifier, count);
        return { data: count <= args.p_max_attempts };
      } } };
      assert.fail(`Unexpected module ${name}`);
    },
  });
  const request = ip => ({ headers: new Headers({ 'x-forwarded-for': ip ?? '192.0.2.1' }) });
  return { ...exports, calls, request };
}

const sellerId = 'b229b580-f2ce-43cd-865a-ce5f6634ff50';
const args = { action: `seller-reminder:${sellerId}`, subject: sellerId, maxAttempts: 1, windowSeconds: 300 };

test('seller reminders are allowed once even though their original subject key exceeds the database limit', async () => {
  const api = fixture();
  const originalKey = `action:${args.action}:subject:${sellerId}`;
  assert.equal(originalKey.length, 104);
  assert.equal(await api.isActionAllowed({ ...args, request: api.request() }), true);
  assert.ok(api.calls.every(call => call.p_identifier.length <= 100));
  assert.equal(await api.isActionAllowed({ ...args, request: api.request() }), false);
  assert.equal(api.calls[1].p_identifier, api.calls[3].p_identifier);
  assert.equal(api.calls[1].p_max_attempts, 1);
  assert.equal(api.calls[1].p_window_seconds, 300);
});

test('long keys retain seller separation and enforce subject limits across changing IP addresses', async () => {
  const api = fixture();
  assert.equal(await api.isActionAllowed({ ...args, request: api.request() }), true);
  assert.equal(await api.isActionAllowed({ ...args, request: api.request('192.0.2.2') }), false);
  const otherId = 'c229b580-f2ce-43cd-865a-ce5f6634ff50';
  assert.equal(await api.isActionAllowed({ ...args, action: `seller-reminder:${otherId}`, subject: otherId, request: api.request() }), true);
  assert.notEqual(api.calls[1].p_identifier, api.calls[5].p_identifier);
});

test('existing short login/action keys remain unchanged and database failures still deny requests', async () => {
  const api = fixture();
  assert.equal(await api.isSignInAllowed(api.request(), 'Teacher'), true);
  assert.deepEqual(api.calls.map(call => call.p_identifier), ['ip:192.0.2.1', 'user:teacher']);
  const failure = fixture({ unavailable: true });
  assert.equal(await failure.isActionAllowed({ ...args, request: failure.request() }), false);
});
