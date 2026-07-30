import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

export const SELLER_TOOLS_CATEGORY = 'เครื่องมือผู้ขาย';

export async function canViewSellerTools(userId: string | null | undefined) {
  if (!userId) return false;

  const { data, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id')
    .eq('owner_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}
