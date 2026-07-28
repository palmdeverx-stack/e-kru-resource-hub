import 'server-only';

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

// ----------------------------------------------------------------------

const rawSecret = process.env.AUTH_JWT_SECRET;

if (!rawSecret) {
  throw new Error('Missing AUTH_JWT_SECRET environment variable');
}

const key = createHash('sha256').update(rawSecret).digest();

export function encryptCredential(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptCredential(value: string | null): string | null {
  if (!value) return null;

  try {
    const [version, iv, authTag, encrypted] = value.split('.');
    if (version !== 'v1' || !iv || !authTag || !encrypted) return null;

    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}
