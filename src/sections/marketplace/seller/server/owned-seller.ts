import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

import { provisionEkruSystemSeller } from './system-seller';

export async function ownedSellerId(ownerId: string, ownerRole?: string | null) {
  const { data } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, status')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (data || ownerRole !== 'master_admin') return data ?? null;

  const provisioned = await provisionEkruSystemSeller(ownerId);
  return provisioned.data ? { id: provisioned.data.id, status: provisioned.data.status } : null;
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
