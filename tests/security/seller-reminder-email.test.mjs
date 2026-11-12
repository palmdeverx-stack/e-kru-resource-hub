import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function load(file, mocks = {}, env = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, process: { env }, require: name => { if (name === 'server-only') return {}; assert.ok(mocks[name], name); return mocks[name]; },
  });
  return exports;
}
const template = load('src/sections/marketplace/admin/server/seller-reminder-email.ts');
function api({ authorized = true, status = 'draft', ownerEmail = 'owner@example.test', allowed = true, mailFailure = false, sender = 'E-KRU <noreply@example.test>', crossSite = false } = {}) {
  const sent = [];
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/auth-token': { requireRole: () => authorized ? { sub: 'admin', role: 'master_admin' } : null },
    'src/lib/request-security': { rejectCrossSiteMutation: () => crossSite ? { status: 403 } : null },
    'src/lib/auth-rate-limit': { isActionAllowed: async (args) => { assert.equal(args.action, 'seller-reminder:seller'); return allowed; } },
    'src/lib/security-audit': { writeSecurityAudit: async () => {} },
    'src/lib/resend': { sendEmail: async (message) => { if (mailFailure) throw new Error('unavailable'); sent.push(message); } },
    'src/sections/marketplace/admin/server/seller-reminder-email': template,
    'src/lib/supabase-admin': { supabaseAdmin: { from: table => {
      assert.ok(['marketplace_sellers', 'marketplace_users'].includes(table));
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: table === 'marketplace_sellers' ? { id: 'seller', owner_id: 'owner', owner_role: 'marketplace_user', display_name: '<Store>', seller_name: 'Seller', status, wizard_step: 3, contact_email: 'different@example.test' } : { email: ownerEmail, first_name: 'Name' } }) };
      return query;
    } } },
  };
  const routes = load('src/app/api/marketplace/admin/seller-accounts/[id]/reminder/route.ts', mocks, { RESEND_FROM_EMAIL: sender, RESEND_REPLY_TO_EMAIL: 'ekru.team@gmail.com' });
  const request = { url: 'https://example.test/reminder' };
  const context = { params: Promise.resolve({ id: 'seller' }) };
  return { preview: () => routes.GET(request, context), send: () => routes.POST(request, context), sent };
}

test('preview uses owner email and escapes shop names without sending', async () => {
  const route = api();
  const result = await route.preview();
  assert.equal(result.status, 200);
  assert.equal(result.body.to, 'owner@example.test');
  assert.match(result.body.html, /&lt;Store&gt;/);
  assert.ok(result.body.html.includes('https://example.test/logo/logo-email.png'));
  assert.ok(result.body.html.includes('alt="E-KRU Marketplace"')); 
  assert.match(result.body.html, /ขออภัยในความไม่สะดวก/);
  assert.match(result.body.subject, /แก้ไขปัญหาเรียบร้อยแล้ว/);
  assert.match(result.body.actionUrl, /profile\/edit\?step=3/);
  assert.equal(route.sent.length, 0);
});
test('explicit send delivers the server-generated template to the owner', async () => {
  const route = api();
  assert.equal((await route.send()).status, 200);
  assert.equal(route.sent.length, 1);
  assert.equal(route.sent[0].to, 'owner@example.test');
  assert.equal(route.sent[0].replyTo, 'ekru.team@gmail.com');
});
test('authorization, CSRF, status, email and rate limit are enforced', async () => {
  for (const [options, status] of [[{ authorized: false }, 403], [{ crossSite: true }, 403], [{ status: 'active' }, 409], [{ status: 'pending' }, 409], [{ ownerEmail: '' }, 400], [{ allowed: false }, 429], [{ sender: '' }, 503]]) {
    const route = api(options);
    assert.equal((await route.send()).status, status);
    assert.equal(route.sent.length, 0);
  }
});
test('delivery failure is reported without success', async () => {
  assert.equal((await api({ mailFailure: true }).send()).status, 502);
});
