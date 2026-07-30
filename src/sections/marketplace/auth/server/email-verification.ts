import 'server-only';

import crypto from 'node:crypto';

import { sendEmail } from 'src/lib/resend';

const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;

function verificationSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) throw new Error('Missing AUTH_JWT_SECRET environment variable');
  return `${secret}:marketplace-email-verification`;
}

export function createVerificationCode() {
  return crypto
    .randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, '0');
}

export function hashVerificationCode(userId: string, code: string) {
  return crypto
    .createHmac('sha256', verificationSecret())
    .update(`${userId}:${code}`)
    .digest('hex');
}

export function verificationCodesMatch(expectedHash: string, userId: string, code: string) {
  const actualHash = hashVerificationCode(userId, code);
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(actualHash, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function verificationExpiry() {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
}

export async function sendMarketplaceVerificationEmail(params: {
  to: string;
  firstName: string;
  code: string;
}) {
  const { to, firstName, code } = params;
  const digits = code
    .split('')
    .map(
      (digit) =>
        `<span style="display:inline-block;padding:10px 12px;margin:0 2px;border-radius:8px;background:#edf5ff;color:#1565f5;font-size:24px;font-weight:700;font-family:monospace">${digit}</span>`
    )
    .join('');

  await sendEmail({
    to,
    subject: `${code} คือรหัสยืนยัน E-KRU Marketplace`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1c252e">
        <div style="margin-bottom:24px">
          <strong style="font-size:20px;color:#1565f5">E-KRU Marketplace</strong>
          <div style="font-size:13px;color:#637381">ตลาดสื่อการสอน</div>
        </div>
        <h2 style="margin:0 0 8px">ยืนยันอีเมลของคุณ</h2>
        <p style="color:#637381">สวัสดี ${escapeHtml(firstName)} ใช้รหัสด้านล่างเพื่อยืนยันการสมัครสมาชิก</p>
        <div style="margin:28px 0;text-align:center">${digits}</div>
        <p style="color:#637381">รหัสนี้มีอายุ ${OTP_TTL_MINUTES} นาที และใช้ได้เพียงครั้งเดียว</p>
        <hr style="border:0;border-top:1px solid #dfe3e8;margin:24px 0">
        <p style="font-size:13px;color:#919eab">หากคุณไม่ได้สมัคร E-KRU Marketplace สามารถละเว้นอีเมลนี้ได้</p>
      </div>
    `,
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return entities[character];
  });
}
