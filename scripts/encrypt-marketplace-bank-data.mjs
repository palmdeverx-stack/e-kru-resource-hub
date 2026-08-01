import { createHash, randomBytes, createCipheriv } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const rawSecret = process.env.FINANCIAL_DATA_ENCRYPTION_KEY;

if (!url || !serviceRoleKey || !rawSecret) {
  throw new Error(
    'Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and FINANCIAL_DATA_ENCRYPTION_KEY first.'
  );
}

const key = createHash('sha256').update(`marketplace-financial-data:${rawSecret}`).digest();
const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function encrypt(value) {
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

const { data: accounts, error: accountsError } = await supabase
  .from('marketplace_seller_payout_accounts')
  .select('seller_id,account_number,promptpay_id,account_number_encrypted,promptpay_id_encrypted');
if (accountsError) throw accountsError;

let accountCount = 0;
for (const account of accounts ?? []) {
  if (!account.account_number && !account.promptpay_id) continue;
  const { error } = await supabase
    .from('marketplace_seller_payout_accounts')
    .update({
      account_number: null,
      promptpay_id: null,
      account_number_encrypted: account.account_number_encrypted || encrypt(account.account_number),
      promptpay_id_encrypted: account.promptpay_id_encrypted || encrypt(account.promptpay_id),
    })
    .eq('seller_id', account.seller_id);
  if (error) throw error;
  accountCount += 1;
}

const { data: payouts, error: payoutsError } = await supabase
  .from('marketplace_payouts')
  .select('id,account_number_snapshot,account_number_snapshot_encrypted');
if (payoutsError) throw payoutsError;

let payoutCount = 0;
for (const payout of payouts ?? []) {
  if (!payout.account_number_snapshot) continue;
  const { error } = await supabase
    .from('marketplace_payouts')
    .update({
      account_number_snapshot: null,
      account_number_snapshot_encrypted:
        payout.account_number_snapshot_encrypted || encrypt(payout.account_number_snapshot),
    })
    .eq('id', payout.id);
  if (error) throw error;
  payoutCount += 1;
}

const { data: finance, error: financeError } = await supabase
  .from('marketplace_finance_settings')
  .select(
    'id,promptpay_id,payout_account_number,promptpay_id_encrypted,payout_account_number_encrypted'
  )
  .eq('id', 'default')
  .maybeSingle();
if (financeError) throw financeError;
let financeCount = 0;
if (finance && (finance.promptpay_id || finance.payout_account_number)) {
  const { error } = await supabase
    .from('marketplace_finance_settings')
    .update({
      promptpay_id: null,
      payout_account_number: null,
      promptpay_id_encrypted: finance.promptpay_id_encrypted || encrypt(finance.promptpay_id),
      payout_account_number_encrypted:
        finance.payout_account_number_encrypted || encrypt(finance.payout_account_number),
    })
    .eq('id', finance.id);
  if (error) throw error;
  financeCount = 1;
}

console.log(
  `Encrypted ${accountCount} payout accounts, ${payoutCount} payout snapshots and ${financeCount} finance settings.`
);
