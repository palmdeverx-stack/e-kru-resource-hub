import 'server-only';

import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function isStripeConfigured() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? '';

  return (
    /^sk_(test|live)_[A-Za-z0-9]{16,}$/.test(secretKey) &&
    /^whsec_[A-Za-z0-9]{16,}$/.test(webhookSecret)
  );
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('ยังไม่ได้ตั้งค่า STRIPE_SECRET_KEY');

  stripeClient ??= new Stripe(secretKey, {
    appInfo: {
      name: 'E-KRU Marketplace',
      version: '1.0.0',
    },
  });
  return stripeClient;
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('ยังไม่ได้ตั้งค่า STRIPE_WEBHOOK_SECRET');
  return secret;
}
