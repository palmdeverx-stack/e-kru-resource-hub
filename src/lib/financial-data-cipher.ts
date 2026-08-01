import 'server-only';

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const rawSecret = process.env.FINANCIAL_DATA_ENCRYPTION_KEY || process.env.AUTH_JWT_SECRET;

if (!rawSecret) {
  throw new Error('Missing FINANCIAL_DATA_ENCRYPTION_KEY environment variable');
}

const key = createHash('sha256').update(`marketplace-financial-data:${rawSecret}`).digest();

export function encryptFinancialValue(value: string | null | undefined) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [
    'fin-v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptFinancialValue(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const [version, iv, authTag, encrypted] = value.split('.');
    if (version !== 'fin-v1' || !iv || !authTag || !encrypted) return null;
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

export function encryptPayoutAccountFields(
  accountNumber: string | null,
  promptpayId: string | null
) {
  return {
    account_number: null,
    promptpay_id: null,
    account_number_encrypted: encryptFinancialValue(accountNumber),
    promptpay_id_encrypted: encryptFinancialValue(promptpayId),
  };
}

export function revealPayoutAccount<T extends Record<string, unknown> | null | undefined>(
  account: T
) {
  if (!account) return account;
  const accountNumber =
    decryptFinancialValue(account.account_number_encrypted) ??
    (typeof account.account_number === 'string' ? account.account_number : null);
  const promptpayId =
    decryptFinancialValue(account.promptpay_id_encrypted) ??
    (typeof account.promptpay_id === 'string' ? account.promptpay_id : null);
  const safeAccount: Record<string, unknown> = { ...account };
  delete safeAccount.account_number_encrypted;
  delete safeAccount.promptpay_id_encrypted;
  return { ...safeAccount, account_number: accountNumber, promptpay_id: promptpayId };
}

export function revealPayoutSnapshot<T extends Record<string, unknown>>(payout: T) {
  const accountNumber =
    decryptFinancialValue(payout.account_number_snapshot_encrypted) ??
    (typeof payout.account_number_snapshot === 'string' ? payout.account_number_snapshot : null);
  const safePayout: Record<string, unknown> = { ...payout };
  delete safePayout.account_number_snapshot_encrypted;
  return { ...safePayout, account_number_snapshot: accountNumber };
}
