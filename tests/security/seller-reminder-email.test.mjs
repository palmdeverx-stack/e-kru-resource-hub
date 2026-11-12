import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { z } from 'zod';

function load(file, mocks = {}, env = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, process: { env }, require: name => { if (name === 'server-only') return {}; assert.ok(mocks[name], name); return mocks[name]; },
  });
  return exports;
}
const template = load('src/sections/marketplace/admin/server/seller-reminder-email.ts');
function api({ authorized = true, status = 'draft', ownerEmail = 'owner@example.test', allowed = true, mailFailure = false, sender = 'E-KRU <noreply@example.test>', crossSite = false, testBody } = {}) {
  const sent = [];
  const mocks = {
    'zod': { z },
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/auth-token': { requireRole: () => authorized ? { sub: 'admin', role: 'master_admin' } : null },
    'src/lib/request-security': { rejectCrossSiteMutation: () => crossSite ? { status: 403 } : null },
    'src/lib/auth-rate-limit': { isActionAllowed: async (args) => { assert.equal(args.action, testBody ? 'seller-reminder-test' : 'seller-reminder:seller'); return allowed; } },
    'src/lib/security-audit': { writeSecurityAudit: async () => {} },
    'src/lib/resend': { getEmailSender: () => sender, getEmailReplyTo: () => 'ekru.team@gmail.com', sendEmail: async (message) => { if (mailFailure) throw new Error('unavailable'); sent.push(message); } },
    'src/sections/marketplace/admin/server/seller-reminder-email': template,
    'src/lib/supabase-admin': { supabaseAdmin: { from: table => {
      assert.ok(['marketplace_sellers', 'marketplace_users'].includes(table));
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: table === 'marketplace_sellers' ? { id: 'seller', owner_id: 'owner', owner_role: 'marketplace_user', display_name: '<Store>', seller_name: 'Seller', status, wizard_step: 3, contact_email: 'different@example.test' } : { email: ownerEmail, first_name: 'Name' } }) };
      return query;
    } } },
  };
  const routes = load('src/app/api/marketplace/admin/seller-accounts/[id]/reminder/route.ts', mocks, { RESEND_FROM_EMAIL: sender, RESEND_REPLY_TO_EMAIL: 'ekru.team@gmail.com' });
  const request = { url: 'https://example.test/reminder', headers: new Headers(testBody ? { 'content-type': 'application/json' } : {}), json: async () => testBody };
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

test('test send uses the specified recipient without changing the seller recipient', async () => {
  const route = api({ testBody: { mode: 'test', to: ' tester@example.test ' } });
  assert.equal((await route.send()).status, 200);
  assert.equal(route.sent[0].to, 'tester@example.test');
  assert.match(route.sent[0].subject, /^\[ตัวอย่าง\]/);
  assert.equal((await route.preview()).body.to, 'owner@example.test');
});
test('test recipient validation and admin authorization run before sending', async () => {
  for (const body of [{ mode: 'test', to: 'bad' }, { to: 'test@example.test' }, { mode: 'test', to: ['a@example.test'] }]) {
    const route = api({ testBody: body });
    assert.equal((await route.send()).status, 400);
    assert.equal(route.sent.length, 0);
  }
  const route = api({ authorized: false, testBody: { mode: 'test', to: 'test@example.test' } });
  assert.equal((await route.send()).status, 403);
  assert.equal(route.sent.length, 0);
});

test('page-level test email needs no seller and enforces admin, CSRF, recipient and rate limit', async () => {
  for (const scenario of ['success', 'unauthorized', 'csrf', 'invalid', 'limited', 'provider']) {
    const sent = [];
    const audits = [];
    const route = load('src/app/api/marketplace/admin/seller-accounts/test-email/route.ts', {
      zod: { z },
      'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
      'src/lib/auth-token': { requireRole: () => scenario === 'unauthorized' ? null : { sub: 'admin', role: 'master_admin' } },
      'src/lib/request-security': { rejectCrossSiteMutation: () => scenario === 'csrf' ? { status: 403 } : null },
      'src/lib/auth-rate-limit': { isActionAllowed: async args => { assert.equal(args.subject, 'admin'); return scenario !== 'limited'; } },
      'src/lib/security-audit': { writeSecurityAudit: async event => audits.push(event) },
      'src/lib/resend': { getEmailSender: () => 'E-KRU <noreply@example.test>', getEmailReplyTo: () => undefined, sendEmail: async message => { if (scenario === 'provider') throw new Error('failure'); sent.push(message); } },
      'src/sections/marketplace/admin/server/seller-reminder-email': template,
    }, { RESEND_FROM_EMAIL: 'E-KRU <noreply@example.test>' });
    const request = { url: 'https://example.test/api/test-email', json: async () => ({ mode: 'test', to: scenario === 'invalid' ? 'invalid' : 'tester@example.test' }) };
    assert.equal((await route.GET(request)).status, scenario === 'unauthorized' ? 403 : 200);
    assert.equal(sent.length, 0);
    const result = await route.POST(request);
    assert.equal(result.status, { success: 200, unauthorized: 403, csrf: 403, invalid: 400, limited: 429, provider: 502 }[scenario]);
    assert.equal(sent.length, scenario === 'success' ? 1 : 0);
    assert.equal(audits.length, scenario === 'success' ? 1 : 0);
    if (scenario === 'success') {
      assert.equal(sent[0].to, 'tester@example.test');
      assert.match(sent[0].subject, /^\[ตัวอย่าง\]/);
      assert.match(sent[0].html, /ร้านค้าตัวอย่าง/);
    }
  }
});
