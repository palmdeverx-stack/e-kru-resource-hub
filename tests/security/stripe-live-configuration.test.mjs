import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../../src/sections/marketplace/checkout/server/stripe.ts', import.meta.url), 'utf8');
// Synthetic credentials only; never embed complete Live-key-shaped literals.
// The Stripe client below is a stub and makes no network requests.
const secret = (mode, label = 'isolatedTestCredential123456', kind = 'sk') =>
  [kind, mode, label].join('_');
const signing = ['whsec', 'isolatedTestSigningSecret123456'].join('_');
function load(overrides = {}, options = {}) {
  const env = { STRIPE_SECRET_KEY: secret('test'), STRIPE_WEBHOOK_SECRET: signing, ...overrides };
  let accountCalls = 0;
  let instances = 0;
  const accounts = [];
  class Stripe {
    constructor(key) {
      instances++;
      this.accounts = { retrieveCurrent: async () => {
        accountCalls++;
        if (options.accountError) throw new Error('provider unavailable');
        const account = { id: options.accountId ?? 'acct_expected', charges_enabled: options.chargesEnabled ?? true };
        accounts.push(account);
        return account;
      } };
      this.customers = { retrieve: async id => {
        if (options.customerError) throw options.customerError;
        return { id, deleted: options.deleted ?? false, livemode: options.customerLiveMode ?? key.startsWith('sk_live_') };
      } };
    }
  }
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } }).outputText, { exports, process: { env }, Date, Error,
    require: name => { if (name === 'server-only') return {}; assert.equal(name, 'stripe'); return Stripe; },
  });
  return { ...exports, env, accountCalls: () => accountCalls, instances: () => instances };
}
const live = { STRIPE_SECRET_KEY: secret('live'), STRIPE_MODE: 'live', STRIPE_ACCOUNT_ID: 'acct_expected' };

test('local Test configuration remains available; production rejects Test keys', () => {
  assert.equal(load().isStripeConfigured(), true);
  assert.equal(load({ VERCEL_ENV: 'production' }).isStripeConfigured(), false);
});
test('Live requires explicit mode and expected account; no credential appears in diagnostics', () => {
  const api = load({ STRIPE_SECRET_KEY: secret('live') });
  assert.equal(api.isStripeConfigured(), false);
  assert.ok(!JSON.stringify(api.getStripeConfiguration()).includes(secret('live')));
  assert.equal(load(live).isStripeConfigured(), true);
});
test('mismatched or malformed keys and mode disable payments', () => {
  for (const overrides of [
    { ...live, STRIPE_MODE: 'test' },
    { ...live, STRIPE_MODE: 'typo' },
    { ...live, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: secret('test', undefined, 'pk') },
    { ...live, STRIPE_WEBHOOK_SECRET: '' },
    { ...live, STRIPE_ACCOUNT_ID: 'not-an-account' },
    { STRIPE_SECRET_KEY: 'invalid' },
  ]) assert.equal(load(overrides).isStripeConfigured(), false);
});
test('restricted Live keys are supported with matching mode/account', () => {
  assert.equal(load({ ...live, STRIPE_SECRET_KEY: secret('live', 'isolatedRestrictedKey123456', 'rk') }).isStripeConfigured(), true);
});
test('Live checkout checks the actual account and ability to accept charges', async () => {
  assert.equal((await load(live).assertStripeReady()).id, 'acct_expected');
  await assert.rejects(load(live, { accountId: 'acct_other' }).assertStripeReady(), /STRIPE_ACCOUNT_ID/);
  await assert.rejects(load(live, { chargesEnabled: false }).assertStripeReady(), /ยังไม่พร้อม/);
});
test('account verification coalesces requests and resets after key rotation', async () => {
  const api = load(live);
  await Promise.all([api.assertStripeReady(), api.assertStripeReady()]);
  assert.equal(api.accountCalls(), 1);
  api.env.STRIPE_SECRET_KEY = secret('live', 'rotatedCredential1234567890');
  await api.assertStripeReady();
  assert.equal(api.accountCalls(), 2);
  assert.equal(api.instances(), 2);
});
test('a failed account lookup can retry rather than caching failure', async () => {
  const api = load(live, { accountError: true });
  await assert.rejects(api.assertStripeReady());
  await assert.rejects(api.assertStripeReady());
  assert.equal(api.accountCalls(), 2);
});
test('webhooks reject wrong mode, missing mode and Connect events before processing', () => {
  const api = load(live);
  assert.doesNotThrow(() => api.assertStripeEventMode({ livemode: true }));
  assert.throws(() => api.assertStripeEventMode({ livemode: false }));
  assert.throws(() => api.assertStripeEventMode({}));
  assert.throws(() => api.assertStripeEventMode({ livemode: true, account: 'acct_other' }));
  assert.throws(() => load({ ...live, STRIPE_WEBHOOK_SECRET: '' }).assertStripeEventMode({ livemode: true }));
});
test('a customer from Test, another account or deleted is not reused in Live', async () => {
  assert.equal(await load(live).resolveStripeCustomerId('cus_live'), 'cus_live');
  assert.equal(await load(live, { customerLiveMode: false }).resolveStripeCustomerId('cus_test'), undefined);
  assert.equal(await load(live, { deleted: true }).resolveStripeCustomerId('cus_deleted'), undefined);
  assert.equal(await load(live, { customerError: { code: 'resource_missing' } }).resolveStripeCustomerId('cus_old'), undefined);
  assert.equal(await load(live).resolveStripeCustomerId(null), undefined);
});
test('customer network/permission failures do not silently create another customer', async () => {
  await assert.rejects(load(live, { customerError: new Error('network unavailable') }).resolveStripeCustomerId('cus_known'), /network unavailable/);
});
