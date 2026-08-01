import 'server-only';

import type { MarketplaceSellerBadge } from '../../shared/types';

import { supabaseAdmin } from 'src/lib/supabase-admin';

export async function getPublicSellerBadges(sellerIds: string[]) {
  const badgesBySeller = new Map<string, MarketplaceSellerBadge[]>();
  if (!sellerIds.length) return badgesBySeller;

  const { data, error } = await supabaseAdmin.rpc('marketplace_public_seller_badges', {
    seller_ids: [...new Set(sellerIds)],
  });
  if (error) {
    if (!['42883', 'PGRST202'].includes(error.code)) {
      console.error('Failed to resolve seller badges', error.message);
    }
    return badgesBySeller;
  }

  ((data ?? []) as MarketplaceSellerBadge[]).forEach((badge) => {
    const current = badgesBySeller.get(badge.seller_id) ?? [];
    current.push(badge);
    badgesBySeller.set(badge.seller_id, current);
  });
  return badgesBySeller;
}
