import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import Stripe from 'stripe';
import ts from 'typescript';

// Execute the real handlers together. Only database, mail, storage and secondary
// notifications are replaced; this does not claim to be a browser/provider E2E.
function load(path, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../' + path, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, {
    exports, URL, Buffer, Date, Error, console,
    process: { env: { AUTH_JWT_SECRET: 'isolated-purchase-lifecycle-test' } },
    require: name => { assert.ok(name in mocks, `Unmocked dependency: ${name}`); return mocks[name]; },
  });
  return exports;
}

function setup() {
  const tables = new Map();
  const rows = name => { if (!tables.has(name)) tables.set(name, []); return tables.get(name); };
  let caller = null;
  let sentCode;
  let signedUrls = 0;
  let failEntitlements = false;
  const db = {
    from(table) {
      let operation = 'select', values, options = {}, single = false;
      const filters = [];
      const query = {
        select: () => query, order: () => query, limit: () => query,
        eq: (key, value) => { filters.push([key, value, false]); return query; },
        ilike: (key, value) => { filters.push([key, value, true]); return query; },
        in: (key, value) => { filters.push([key, value, false]); return query; },
        insert: value => { operation = 'insert'; values = value; return query; },
        update: value => { operation = 'update'; values = value; return query; },
        upsert: (value, opts) => { operation = 'upsert'; values = value; options = opts ?? {}; return query; },
        delete: () => { operation = 'delete'; return query; },
        single: () => { single = true; return query; },
        maybeSingle: () => { single = true; return query; },
        then(resolve, reject) {
          try {
            if (failEntitlements && table === 'marketplace_user_licenses') return resolve({ error: new Error('license store unavailable'), data: null });
            const matched = rows(table).filter(row => filters.every(([key, value, insensitive]) => {
              const actual = key.startsWith('order.') ? rows('marketplace_orders').find(o => o.id === row.order_id)?.[key.slice(6)] : row[key];
              return Array.isArray(value) ? value.includes(actual) : insensitive ? String(actual).toLowerCase() === String(value).toLowerCase() : actual === value;
            }));
            let result = matched;
            if (operation === 'insert' || operation === 'upsert') {
              result = [];
              for (const value of Array.isArray(values) ? values : [values]) {
                const keys = options.onConflict?.split(',') ?? (table === 'marketplace_stripe_events' ? ['event_id'] : []);
                const existing = keys.length && rows(table).find(row => keys.every(key => row[key] === value[key]));
                if (existing) { if (!options.ignoreDuplicates) Object.assign(existing, value); result.push(existing); }
                else { const row = { id: crypto.randomUUID(), attempts: 0, status: 'active', ...value }; rows(table).push(row); result.push(row); }
              }
            } else if (operation === 'update') matched.forEach(row => Object.assign(row, values));
            else if (operation === 'delete') tables.set(table, rows(table).filter(row => !matched.includes(row)));
            const joined = result.map(row => {
              if (table === 'marketplace_payment_sessions') return { ...row, orders: rows('marketplace_orders').filter(o => o.payment_session_id === row.id) };
              if (table === 'marketplace_order_items') return { ...row, product: rows('marketplace_products').find(p => p.id === row.product_id), order: [rows('marketplace_orders').find(o => o.id === row.order_id)] };
              return { ...row };
            });
            resolve({ data: single ? joined[0] ?? null : joined, error: null, count: result.length });
          } catch (error) { reject(error); }
        },
      };
      return query;
    },
    auth: { admin: {
      createUser: async () => ({ data: { user: { id: 'auth-buyer' } }, error: null }),
      updateUserById: async () => ({ error: null }), deleteUser: async () => ({ error: null }),
    } },
    storage: { from: () => ({ createSignedUrl: async (path, ttl, options) => {
      signedUrls++;
      assert.equal(ttl, 60);
      assert.equal(options.download, 'แบบฝึกหัด.pdf');
      return { data: { signedUrl: 'https://storage.example.test/' + path }, error: null };
    } }) },
  };
  const next = { NextResponse: {
    json: (body, options = {}) => ({ body, status: options.status ?? 200, cookies: { set: () => {} } }),
    redirect: (location, status) => ({ location, status }),
  }, after: () => {} };
  const auth = {
    requireAuthenticated: () => caller,
    signAppToken: value => { caller = value; return 'isolated-session'; },
    toPublicUser: value => value, ACCESS_TOKEN_COOKIE: 'token', accessTokenCookieOptions: {},
  };
  const common = {
    'server-only': {}, 'next/server': next,
    'src/lib/supabase-admin': { supabaseAdmin: db },
    'src/lib/auth-token': auth,
    'src/lib/auth-rate-limit': { isActionAllowed: async () => true },
    'src/lib/request-security': { rejectCrossSiteMutation: () => null },
    'src/lib/security-audit': { writeSecurityAudit: async () => {} },
    'src/lib/notifications': { createNotifications: async () => {} },
  };
  const email = load('src/sections/marketplace/auth/server/email-verification.ts', {
    'server-only': {}, 'node:crypto': crypto, 'src/lib/resend': { sendEmail: async ({ subject }) => { sentCode = subject.slice(0, 6); } },
  });
  const signup = load('src/app/api/auth/sign-up/route.ts', { ...common,
    'src/sections/marketplace/auth/server/email-verification': email,
    'src/sections/marketplace/admin/server/line-notifications': { notifyMarketplaceMemberRegistered: async () => {} },
  });
  const verify = load('src/app/api/auth/verify-email/route.ts', { ...common,
    'src/sections/marketplace/auth/server/email-verification': email,
  });
  // The download relation is an array, while the entitlement select requests an
  // object relation. Normalize it at the query boundary as PostgREST does.
  const entitlementDb = { ...db, from: table => {
    const query = db.from(table);
    if (table !== 'marketplace_order_items') return query;
    const then = query.then;
    query.then = (resolve, reject) => then(result => {
      result.data = result.data.map(row => ({ ...row, order: row.order[0] }));
      resolve(result);
    }, reject);
    return query;
  } };
  const actualEntitlements = load('src/sections/marketplace/checkout/server/grant-feature-entitlements.ts', { ...common,
    'src/lib/supabase-admin': { supabaseAdmin: entitlementDb },
    'src/lib/school-subscription': { grantSchoolFeatureUntil: async () => {} },
  });
  const accounting = { recordShippingCustomerChargeForOrder: async () => {}, recordShippingPaymentFee: async () => {}, recordShippingRefundForOrders: async () => {} };
  const evidence = { recordCustomerCommunication: async () => {}, recordEntitlementUsage: async () => ({ ipAddress: null, userAgent: null, requestId: 'test' }) };
  const finalize = load('src/sections/marketplace/checkout/server/finalize-payment.ts', { ...common,
    './order-evidence': evidence,
    '../../admin/server/finance': { money: n => Math.round(n * 100) / 100, getFinanceSettings: async () => ({ hold_days: 7 }) },
    '../../referrals/server/referrals': { createReferralRewards: async () => {} },
    './school-onboarding': { createSchoolOnboardingForPaidOrders: async () => false },
    './grant-feature-entitlements': actualEntitlements,
    '../../seller/server/seller-line-notifications': { notifySellerPaymentReceived: async () => {} },
    '../../shipping/server/accounting': accounting,
  });
  const stripe = new Stripe('sk_test_isolated_no_network_calls');
  const secret = 'whsec_isolated_test_only';
  const webhook = load('src/app/api/stripe/webhook/route.ts', { ...common,
    'src/sections/marketplace/checkout/server/stripe': { getStripe: () => stripe, getStripeWebhookSecret: () => secret },
    'src/sections/marketplace/checkout/server/finalize-payment': finalize,
    'src/sections/marketplace/shipping/server/accounting': accounting,
    'src/sections/marketplace/checkout/server/license-lifecycle': {},
    'src/sections/marketplace/checkout/server/license-subscriptions': {},
    'src/sections/marketplace/checkout/server/dispute-lifecycle': {},
  });
  const download = load('src/app/api/marketplace/downloads/[fileId]/route.ts', { ...common,
    'src/sections/marketplace/checkout/server/order-evidence': evidence,
  });
  const request = body => ({ url: 'https://example.test/api/auth', json: async () => body });
  async function register() {
    const result = await signup.POST(request({ username: 'buyer.test', password: 'test-password', email: 'buyer@example.test', firstName: 'Test', lastName: 'Buyer' }));
    assert.equal(result.status, 200);
    assert.equal(rows('marketplace_users')[0].is_active, false);
    assert.match(sentCode, /^\d{6}$/);
    return verify.POST(request({ email: 'buyer@example.test', code: sentCode }));
  }
  function seedCheckout() {
    assert.ok(caller, 'verify account first');
    rows('marketplace_products').push({ id: 'product', resource_type: 'feature_unlock', grants_feature_keys: ['student_reports'], grant_duration_days: 30, license_scope: 'individual' });
    rows('marketplace_payment_sessions').push({ id: 'session', buyer_id: caller.sub, amount: 100, currency: 'THB', status: 'pending_payment', payment_method: 'stripe', stripe_checkout_session_id: 'cs_test_fixture' });
    rows('marketplace_orders').push({ id: 'order', buyer_id: caller.sub, seller_id: 'seller', payment_session_id: 'session', status: 'pending_payment', gross_amount: 100, seller_net: 90, platform_fee: 10, commission_rate: 10 });
    rows('marketplace_order_items').push({ id: 'item', order_id: 'order', product_id: 'product' });
    rows('marketplace_product_files').push({ id: 'file', product_id: 'product', storage_bucket: 'marketplace-product-files', storage_path: 'private/uuid.pdf', file_name: 'แบบฝึกหัด.pdf', scan_status: 'safe' });
  }
  async function pay({ id = 'evt_test_paid', amount = 10000, currency = 'thb', sessionId = 'cs_test_fixture', signed = true } = {}) {
    const payload = JSON.stringify({ id, type: 'checkout.session.completed', data: { object: { id: sessionId, metadata: { marketplace_payment_session_id: 'session' }, amount_total: amount, currency, payment_status: 'paid' } } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: signed ? secret : 'wrong-secret' });
    return webhook.POST({ headers: new Headers({ 'stripe-signature': signature }), text: async () => payload });
  }
  const getFile = () => download.GET({ url: 'https://example.test/download?orderItemId=item' }, { params: Promise.resolve({ fileId: 'file' }) });
  return { rows, register, seedCheckout, pay, getFile, finalize: finalize.finalizeMarketplacePayment,
    setCaller: value => { caller = value; }, signedUrls: () => signedUrls,
    failEntitlements: value => { failEntitlements = value; },
    verifyAgain: () => verify.POST(request({ email: 'buyer@example.test', code: sentCode })),
  };
}

test('verified signup → signed payment callback → license → authorized download, retry without duplicates', async () => {
  const flow = setup();
  assert.equal((await flow.register()).status, 200);
  assert.equal(flow.rows('marketplace_users')[0].is_active, true);
  assert.equal((await flow.verifyAgain()).status, 409);
  flow.seedCheckout();
  assert.equal((await flow.getFile()).status, 403);
  assert.equal(flow.signedUrls(), 0);
  assert.equal((await flow.pay()).status, 200);
  assert.equal(flow.rows('marketplace_payment_sessions')[0].status, 'verified');
  assert.equal(flow.rows('marketplace_orders')[0].status, 'paid');
  assert.equal(flow.rows('marketplace_user_licenses').length, 1);
  assert.equal(flow.rows('marketplace_user_licenses')[0].buyer_id, flow.rows('marketplace_users')[0].id);
  assert.equal(flow.rows('marketplace_ledger_entries').length, 2);
  assert.equal((await flow.getFile()).status, 307);
  assert.equal((await flow.pay()).status, 200);
  assert.equal((await flow.pay({ id: 'evt_test_repeated_success' })).status, 200);
  assert.equal(flow.rows('marketplace_user_licenses').length, 1);
  assert.equal(flow.rows('marketplace_ledger_entries').length, 2);
  flow.setCaller({ sub: 'other-buyer' });
  assert.equal((await flow.getFile()).status, 403);
  flow.setCaller(null);
  assert.equal((await flow.getFile()).status, 401);
  assert.equal(flow.signedUrls(), 1);
});

for (const [name, values, expected] of [
  ['invalid signature', { signed: false }, 400],
  ['wrong amount', { amount: 1 }, 500],
  ['wrong currency', { currency: 'usd' }, 500],
  ['wrong checkout session', { sessionId: 'cs_wrong' }, 500],
]) test(`payment rejects ${name} before granting access`, async () => {
  const flow = setup();
  await flow.register(); flow.seedCheckout();
  assert.equal((await flow.pay(values)).status, expected);
  assert.equal(flow.rows('marketplace_orders')[0].status, 'pending_payment');
  assert.equal(flow.rows('marketplace_user_licenses').length, 0);
  assert.equal((await flow.getFile()).status, 403);
});

test('failed license fulfillment is recovered on webhook retry without charging or duplicating ledger', async () => {
  const flow = setup(); await flow.register(); flow.seedCheckout();
  flow.failEntitlements(true);
  assert.equal((await flow.pay()).status, 500);
  assert.equal(flow.rows('marketplace_payment_sessions')[0].status, 'verified');
  assert.equal(flow.rows('marketplace_stripe_events')[0].status, 'failed');
  flow.failEntitlements(false);
  assert.equal((await flow.pay()).status, 200);
  assert.equal(flow.rows('marketplace_stripe_events')[0].status, 'processed');
  assert.equal(flow.rows('marketplace_user_licenses').length, 1);
  assert.equal(flow.rows('marketplace_ledger_entries').length, 2);
});

test('refunded orders and mismatched product files cannot generate download links', async () => {
  const flow = setup(); await flow.register(); flow.seedCheckout(); await flow.pay();
  flow.rows('marketplace_orders')[0].status = 'refunded';
  assert.equal((await flow.getFile()).status, 403);
  flow.rows('marketplace_orders')[0].status = 'paid';
  flow.rows('marketplace_product_files')[0].product_id = 'other-product';
  assert.equal((await flow.getFile()).status, 403);
  flow.rows('marketplace_product_files')[0].product_id = 'product';
  flow.rows('marketplace_product_files')[0].scan_status = 'rejected';
  assert.equal((await flow.getFile()).status, 423);
  assert.equal(flow.signedUrls(), 0);
});
