import 'server-only';

import crypto from 'node:crypto';

export type ShippingQuoteToken = {
  sellerId: string;
  courierCode: string;
  courierName: string;
  courierRef: string;
  serviceName: string;
  serviceType: 'pick_up' | 'drop_off';
  price: number;
  expiresAt: number;
};

function secret() {
  const value = process.env.MARKETPLACE_SHIPPING_QUOTE_SECRET ?? process.env.AUTH_SECRET;
  if (!value) throw new Error('ยังไม่ได้ตั้งค่า MARKETPLACE_SHIPPING_QUOTE_SECRET');
  return value;
}

export function signShippingQuote(value: Omit<ShippingQuoteToken, 'expiresAt'>) {
  const payload = Buffer.from(
    JSON.stringify({ ...value, expiresAt: Date.now() + 15 * 60_000 })
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyShippingQuote(token: string): ShippingQuoteToken {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) throw new Error('ใบเสนอค่าขนส่งไม่ถูกต้อง');
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new Error('ใบเสนอค่าขนส่งไม่ถูกต้อง');
  }
  const value = JSON.parse(Buffer.from(payload, 'base64url').toString()) as ShippingQuoteToken;
  if (value.expiresAt < Date.now()) throw new Error('ใบเสนอค่าขนส่งหมดอายุ กรุณาคำนวณใหม่');
  return value;
}
