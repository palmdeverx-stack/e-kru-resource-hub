import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

export const hashSsoValue = (value: string) => createHash('sha256').update(value).digest('hex');
export const ssoChallenge = (value: string) =>
  createHash('sha256').update(value).digest('base64url');
export const validSsoVerifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(value);

export function ssoConfig() {
  const secret = process.env.MARKETPLACE_SSO_SECRET;
  const callback = new URL(process.env.EKRU_SSO_CALLBACK_URL || 'https://invalid.local');
  const base = new URL(process.env.NEXT_PUBLIC_EKRU_URL || 'https://invalid.local');
  if (
    !secret ||
    secret.length < 32 ||
    callback.protocol !== 'https:' ||
    callback.origin !== base.origin ||
    callback.hostname === 'invalid.local' ||
    callback.username ||
    callback.password ||
    callback.search ||
    callback.hash
  ) {
    throw new Error('SSO is not configured');
  }
  return { secret, callback: callback.href };
}

export function validSsoClient(request: Request, secret: string) {
  const provided = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
