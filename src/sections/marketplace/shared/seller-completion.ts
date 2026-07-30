type SellerCompletionInput = {
  display_name?: string | null;
  bio?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  seller_name?: string | null;
  phone?: string | null;
  contact_email?: string | null;
  payout_account?: unknown;
  documents?: unknown[] | null;
  has_payout_account?: boolean;
  has_documents?: boolean;
  seller_agreement_accepted_at?: string | null;
  copyright_confirmed_at?: string | null;
  fee_agreement_accepted_at?: string | null;
  pdpa_accepted_at?: string | null;
};

export const VERIFIED_SELLER_COMPLETION_THRESHOLD = 80;

type SystemSellerInput = {
  is_system_store?: boolean;
  owner_role?: string | null;
};

export function getSellerProfileCompletion(seller: SellerCompletionInput) {
  const completionItems = [
    Boolean(seller.display_name),
    Boolean(seller.bio),
    Boolean(seller.logo_url),
    Boolean(seller.cover_url),
    Boolean(seller.seller_name),
    Boolean(seller.phone),
    Boolean(seller.contact_email),
    seller.has_payout_account ?? Boolean(seller.payout_account),
    seller.has_documents ?? Boolean(seller.documents?.length),
    Boolean(
      seller.seller_agreement_accepted_at &&
        seller.copyright_confirmed_at &&
        seller.fee_agreement_accepted_at &&
        seller.pdpa_accepted_at
    ),
  ];

  return Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100);
}

export function isSellerProfileVerified(completion?: number | null) {
  return Number(completion) > VERIFIED_SELLER_COMPLETION_THRESHOLD;
}

export function isSystemMarketplaceSeller(seller?: SystemSellerInput | null) {
  return seller?.is_system_store === true || seller?.owner_role === 'master_admin';
}
