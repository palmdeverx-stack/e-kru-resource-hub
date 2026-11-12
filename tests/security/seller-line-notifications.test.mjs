import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function load({ enabled = true, eventEnabled = true, lineOk = true } = {}) {
  let sent;
  const deliveries = [];
  const mocks = {
    'server-only': {},
    'src/lib/line-credentials': { decryptLineCredential: () => 'test-token' },
    'src/lib/notifications': { createNotifications: async () => {} },
    'src/lib/supabase-admin': { supabaseAdmin: { from: table => {
      const query = {
        select: () => query, eq: () => query, in: () => query,
        insert: value => { deliveries.push(value); return query; },
        update: value => { deliveries.push(value); return query; },
        single: async () => ({ data: { id: 'delivery' } }),
        maybeSingle: async () => ({ data: { is_enabled: enabled, notify_new_seller: eventEnabled, channel_access_token_encrypted: 'encrypted', line_user_id: 'recipient' } }),
        then: resolve => resolve({ data: [] }),
      };
      return query;
    } } },
  };
  const exports = {};
  const source = readFileSync(new URL('../../src/sections/marketplace/admin/server/line-notifications.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, console,
    require: name => { assert.ok(mocks[name], name); return mocks[name]; },
    fetch: async (url, options) => { assert.equal(url, 'https://api.line.me/v2/bot/message/push'); sent = JSON.parse(options.body); return { ok: lineOk, status: lineOk ? 200 : 500, json: async () => ({ message: 'LINE unavailable' }) }; },
  });
  return { notify: () => exports.notifyMarketplaceAdmins({ event: 'new_seller', sourceId: 'seller', dedupeKey: 'seller:request', message: 'มีคำขอเปิดร้านใหม่\nชื่อร้าน: Test', actionUrl: 'https://example.test/dashboard/seller-approvals/seller' }), sent: () => sent, deliveries };
}
test('new seller application sends LINE with a direct approval link and records delivery', async () => {
  const api = load();
  assert.equal((await api.notify()).status, 'sent');
  assert.equal(api.sent().to, 'recipient');
  assert.match(api.sent().messages[0].text, /seller-approvals\/seller/);
  assert.equal(api.deliveries.at(-1).status, 'sent');
});
test('disabled notifications do not send LINE', async () => {
  for (const config of [{ enabled: false }, { eventEnabled: false }]) {
    const api = load(config);
    assert.equal((await api.notify()).status, 'skipped');
    assert.equal(api.sent(), undefined);
  }
});
test('LINE failure is recorded without rejecting seller notification workflow', async () => {
  const api = load({ lineOk: false });
  assert.equal((await api.notify()).status, 'failed');
  assert.equal(api.deliveries.at(-1).last_error, 'LINE unavailable');
});
