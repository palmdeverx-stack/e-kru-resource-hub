import 'server-only';

import { unstable_cache } from 'next/cache';

import { supabaseAdmin } from 'src/lib/supabase-admin';

async function loadPublicMarketplaceStats() {
  const [
    teachersResult,
    productsResult,
    schoolsResult,
    externalMembersResult,
    sellersResult,
    completedOrdersResult,
  ] = await Promise.all([
    supabaseAdmin
      .from('app_users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'teacher')
      .eq('is_active', true),
    supabaseAdmin
      .from('marketplace_products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published'),
    supabaseAdmin
      .from('schools')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabaseAdmin
      .from('marketplace_users')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabaseAdmin
      .from('marketplace_sellers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabaseAdmin
      .from('marketplace_orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['paid', 'completed']),
  ]);

  const error = [
    teachersResult,
    productsResult,
    schoolsResult,
    externalMembersResult,
    sellersResult,
    completedOrdersResult,
  ].find((result) => result.error)?.error;
  if (error) throw new Error(error.message);

  return {
    teachers: teachersResult.count ?? 0,
    products: productsResult.count ?? 0,
    schools: schoolsResult.count ?? 0,
    externalMembers: externalMembersResult.count ?? 0,
    activeSellers: sellersResult.count ?? 0,
    completedOrders: completedOrdersResult.count ?? 0,
    updatedAt: new Date().toISOString(),
  };
}

// Public aggregate counts use the same five-minute freshness as the API CDN.
export const getPublicMarketplaceStats = unstable_cache(
  loadPublicMarketplaceStats,
  ['marketplace-public-stats-v1'],
  { revalidate: 300 }
);
