import 'server-only';

import Stripe from 'stripe';

export type StripeMode = 'test' | 'live';

let stripeClient: Stripe | null = null;
let clientKey = '';
let accountLookup: { expiresAt: number; promise: Promise<Stripe.Account> } | null = null;

export function getStripeConfiguration() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? '';
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? '';
  const expectedMode = process.env.STRIPE_MODE?.trim() ?? '';
  const accountId = process.env.STRIPE_ACCOUNT_ID?.trim() ?? '';
  const match = /^(?:sk|rk)_(test|live)_[A-Za-z0-9]{16,}$/.exec(secretKey);
  const mode = (match?.[1] as StripeMode | undefined) ?? null;
  const issues: string[] = [];

  if (!mode) issues.push('STRIPE_SECRET_KEY ไม่ถูกต้องหรือยังไม่ได้ตั้งค่า');
  if (!/^whsec_[A-Za-z0-9]{16,}$/.test(webhookSecret)) {
    issues.push('ยังไม่ได้ตั้งค่า STRIPE_WEBHOOK_SECRET ของ endpoint นี้');
  }
  if (expectedMode && !['test', 'live'].includes(expectedMode)) {
    issues.push('STRIPE_MODE ต้องเป็น test หรือ live');
  } else if (expectedMode && expectedMode !== mode) {
    issues.push('โหมดของ Stripe key ไม่ตรงกับ STRIPE_MODE');
  }
  if (publishableKey && !new RegExp(`^pk_${mode}_[A-Za-z0-9]{16,}$`).test(publishableKey)) {
    issues.push('Publishable key และ Secret key ต้องเป็นโหมดเดียวกัน');
  }
  if (accountId && !/^acct_[A-Za-z0-9]+$/.test(accountId)) {
    issues.push('STRIPE_ACCOUNT_ID ไม่ถูกต้อง');
  }
  if (mode === 'live' && (expectedMode !== 'live' || !accountId)) {
    issues.push('Live mode ต้องระบุ STRIPE_MODE=live และ STRIPE_ACCOUNT_ID ให้ชัดเจน');
  }
  if (process.env.VERCEL_ENV === 'production' && mode !== 'live') {
    issues.push('Production ต้องใช้ Stripe Live key');
  }
  return { configured: issues.length === 0, mode, accountId: accountId || null, issues };
}

export function isStripeConfigured() {
  return getStripeConfiguration().configured;
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  if (!/^(?:sk|rk)_(test|live)_[A-Za-z0-9]{16,}$/.test(secretKey)) {
    throw new Error('ยังไม่ได้ตั้งค่า STRIPE_SECRET_KEY ที่ถูกต้อง');
  }
  if (!stripeClient || clientKey !== secretKey) {
    stripeClient = new Stripe(secretKey, {
      appInfo: { name: 'E-KRU Marketplace', version: '1.0.0' },
    });
    clientKey = secretKey;
    accountLookup = null;
  }
  return stripeClient;
}

export async function assertStripeReady() {
  const configuration = getStripeConfiguration();
  if (!configuration.configured) throw new Error(configuration.issues.join('; '));
  const stripe = getStripe();
  if (!accountLookup || accountLookup.expiresAt <= Date.now()) {
    const lookup = {
      expiresAt: Date.now() + 60_000,
      promise: stripe.accounts.retrieveCurrent(),
    };
    accountLookup = lookup;
    lookup.promise.catch(() => {
      if (accountLookup === lookup) accountLookup = null;
    });
  }
  const account = await accountLookup.promise;
  if (configuration.accountId && account.id !== configuration.accountId) {
    throw new Error('Stripe key ไม่ใช่บัญชีที่กำหนดใน STRIPE_ACCOUNT_ID');
  }
  if (configuration.mode === 'live' && !account.charges_enabled) {
    throw new Error('บัญชี Stripe ยังไม่พร้อมรับชำระเงินจริง กรุณาตรวจสอบใน Stripe Dashboard');
  }
  return account;
}

/** Old test/account customer IDs must never be reused blindly after switching keys. */
export async function resolveStripeCustomerId(customerId: string | null | undefined) {
  if (!customerId) return undefined;
  try {
    const customer = await getStripe().customers.retrieve(customerId);
    if (customer.deleted || customer.livemode !== (getStripeConfiguration().mode === 'live')) {
      return undefined;
    }
    return customer.id;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'resource_missing') {
      return undefined;
    }
    throw error;
  }
}

export function assertStripeEventMode(event: { livemode: boolean; account?: string }) {
  const configuration = getStripeConfiguration();
  if (!configuration.configured) throw new Error('การตั้งค่า Stripe ยังไม่พร้อมรับ Webhook');
  if (event.livemode !== (configuration.mode === 'live')) {
    throw new Error('โหมดของ Stripe event ไม่ตรงกับระบบรับชำระ');
  }
  // This integration collects on the platform account, not Stripe Connect accounts.
  if (event.account) throw new Error('ไม่รองรับ Stripe Connect event ใน endpoint นี้');
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error('ยังไม่ได้ตั้งค่า STRIPE_WEBHOOK_SECRET');
  return secret;
}
