import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

export async function cleanupUnusedSellerTags() {
  const { data: candidates, error } = await supabaseAdmin
    .from('marketplace_tags')
    .select('id')
    .not('created_by', 'is', null)
    .is('first_used_at', null)
    .lte('expires_at', new Date().toISOString());

  if (error || !candidates?.length) {
    return { deleted: 0, error };
  }

  const candidateIds = candidates.map((tag) => tag.id);
  const { data: usage, error: usageError } = await supabaseAdmin
    .from('marketplace_product_tags')
    .select('tag_id')
    .in('tag_id', candidateIds);
  if (usageError) return { deleted: 0, error: usageError };

  const usedIds = new Set((usage ?? []).map((row) => row.tag_id));
  const removableIds = candidateIds.filter((id) => !usedIds.has(id));
  if (!removableIds.length) return { deleted: 0, error: null };

  const { data: removed, error: deleteError } = await supabaseAdmin
    .from('marketplace_tags')
    .delete()
    .in('id', removableIds)
    .select('id');

  return { deleted: removed?.length ?? 0, error: deleteError };
}
