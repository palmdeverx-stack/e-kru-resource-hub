import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

export async function cleanupUnusedSellerCategories() {
  const { data, error } = await supabaseAdmin.rpc('marketplace_cleanup_unused_categories');
  // Keep existing catalogs available during the migration rollout.
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    return { deleted: 0, error: null };
  }
  return { deleted: Number(data ?? 0), error };
}

export async function cleanupUnusedSellerLookups() {
  const { data, error } = await supabaseAdmin.rpc('marketplace_cleanup_unused_lookups');
  if (error?.code === 'PGRST202' || error?.code === '42883') return { deleted: 0, error: null };
  return { deleted: Number(data ?? 0), error };
}
