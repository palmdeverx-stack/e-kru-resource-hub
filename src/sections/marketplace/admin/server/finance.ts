import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

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
  return data ?? DEFAULT_FINANCE_SETTINGS;
}

export function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
