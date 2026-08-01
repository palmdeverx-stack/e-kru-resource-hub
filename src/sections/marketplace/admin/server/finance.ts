import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { decryptFinancialValue } from 'src/lib/financial-data-cipher';

export const DEFAULT_FINANCE_SETTINGS = {
  id: 'default',
  promptpay_id: null,
  promptpay_account_name: null,
  payout_bank_code: null,
  payout_bank_name: null,
  payout_account_number: null,
  payout_account_name: null,
  commission_rate: 10,
  hold_days: 7,
  payout_day: 5,
  minimum_payout: 100,
  stripe_enabled: false,
  is_active: false,
};

export async function getFinanceSettings() {
  const { data, error } = await supabaseAdmin
    .from('marketplace_finance_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  if (error) throw error;
  if (!data) return DEFAULT_FINANCE_SETTINGS;
  return {
    ...data,
    promptpay_id: decryptFinancialValue(data.promptpay_id_encrypted) ?? data.promptpay_id ?? null,
    payout_account_number:
      decryptFinancialValue(data.payout_account_number_encrypted) ??
      data.payout_account_number ??
      null,
    promptpay_id_encrypted: undefined,
    payout_account_number_encrypted: undefined,
  };
}

export function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
