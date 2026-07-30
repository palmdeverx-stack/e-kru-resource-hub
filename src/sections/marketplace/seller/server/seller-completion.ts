import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

import { getSellerProfileCompletion } from '../../shared/seller-completion';

export async function getSellerProfileCompletionById(sellerId: string) {
  const [{ data: seller, error }, documentsResult, payoutResult] = await Promise.all([
    supabaseAdmin
      .from('marketplace_sellers')
      .select(
        'display_name, bio, logo_url, cover_url, seller_name, phone, contact_email, seller_agreement_accepted_at, copyright_confirmed_at, fee_agreement_accepted_at, pdpa_accepted_at'
      )
      .eq('id', sellerId)
      .maybeSingle(),
    supabaseAdmin
      .from('marketplace_seller_documents')
      .select('seller_id', { count: 'exact', head: true })
      .eq('seller_id', sellerId),
    supabaseAdmin
      .from('marketplace_seller_payout_accounts')
      .select('seller_id', { count: 'exact', head: true })
      .eq('seller_id', sellerId),
  ]);

  if (error || !seller) return 0;

  return getSellerProfileCompletion({
    ...seller,
    has_documents: (documentsResult.count ?? 0) > 0,
    has_payout_account: (payoutResult.count ?? 0) > 0,
  });
}
