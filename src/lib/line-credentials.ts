import 'server-only';

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

// ----------------------------------------------------------------------

function encryptionKey() {
  const secret =
    process.env.LINE_CREDENTIALS_ENCRYPTION_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('ยังไม่ได้ตั้งค่า LINE_CREDENTIALS_ENCRYPTION_KEY');
  return createHash('sha256').update(secret).digest();
}

export function encryptLineCredential(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export function decryptLineCredential(value: string) {
  const [version, iv, tag, encrypted] = value.split(':');
  if (version !== 'v1' || !iv || !tag || !encrypted) {
    throw new Error('ข้อมูลเชื่อมต่อ LINE ไม่ถูกต้อง');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
