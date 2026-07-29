import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

export async function ownedSellerId(ownerId: string) {
  const { data } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, status')
    .eq('owner_id', ownerId)
    .maybeSingle();
  return data ?? null;
}

export async function ownedProduct(productId: string, sellerId: string) {
  const { data } = await supabaseAdmin
    .from('marketplace_products')
    .select('id')
    .eq('id', productId)
    .eq('seller_id', sellerId)
    .maybeSingle();
  return data ?? null;
}
