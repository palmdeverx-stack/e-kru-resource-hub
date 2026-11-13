import 'server-only';

import { unstable_cache } from 'next/cache';

import { supabaseAdmin } from 'src/lib/supabase-admin';

import { getPublicSellerBadges } from './seller-badges';
import { getSellerProfileCompletion } from '../../shared/seller-completion';

type ProductRatingRow = {
  seller_id: string;
  reviews?: Array<{ rating?: number | null }> | null;
};

type StoreViewCountRow = { seller_id: string; view_count: number | string };

async function loadLegacyPublicStoreDirectory(search: string, page: number, limit: number) {
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('marketplace_sellers')
    .select(
      'id, display_name, display_name_en, slug, logo_url, cover_url, bio, seller_type, owner_role, seller_name, phone, contact_email, seller_agreement_accepted_at, copyright_confirmed_at, fee_agreement_accepted_at, pdpa_accepted_at, document_count:marketplace_seller_documents(count), payout_count:marketplace_seller_payout_accounts(count)',
      { count: 'exact' }
    )
    .eq('status', 'active')
    .neq('owner_role', 'master_admin')
    .order('display_name', { ascending: true })
    .range(offset, offset + limit - 1);

  const safeSearch = search.replace(/[^\p{L}\p{N}\s._-]/gu, '').trim();
  if (safeSearch) {
    query = query.or(`display_name.ilike.%${safeSearch}%,display_name_en.ilike.%${safeSearch}%`);
  }

  const { data: sellers, error, count } = await query;
  if (error) {
    if (error.code === '42P01') {
      return { stores: [], total: 0, page, totalPages: 0, updatedAt: new Date().toISOString() };
    }
    throw new Error(error.message);
  }

  const sellerIds = (sellers ?? []).map((seller) => seller.id);
  const [{ data: productRows, error: productError }, { data: viewCountRows }, badgesBySeller] =
    await Promise.all([
      sellerIds.length
        ? supabaseAdmin
            .from('marketplace_products')
            .select('seller_id, reviews:marketplace_product_reviews(rating)')
            .in('seller_id', sellerIds)
            .eq('status', 'published')
        : Promise.resolve({ data: [], error: null }),
      sellerIds.length
        ? supabaseAdmin.rpc('marketplace_public_store_view_counts', { seller_ids: sellerIds })
        : Promise.resolve({ data: [] }),
      getPublicSellerBadges(sellerIds),
    ]);
  if (productError) {
    throw new Error(productError.message);
  }
  const viewCounts = new Map(
    ((viewCountRows ?? []) as StoreViewCountRow[]).map((row) => [
      row.seller_id,
      Number(row.view_count ?? 0),
    ])
  );

  const sellerStats = new Map<
    string,
    { productCount: number; reviewCount: number; ratingTotal: number }
  >();
  ((productRows ?? []) as ProductRatingRow[]).forEach((product) => {
    const stats = sellerStats.get(product.seller_id) ?? {
      productCount: 0,
      reviewCount: 0,
      ratingTotal: 0,
    };
    stats.productCount += 1;
    (product.reviews ?? []).forEach((review) => {
      const rating = Number(review.rating);
      if (!Number.isFinite(rating)) return;
      stats.reviewCount += 1;
      stats.ratingTotal += rating;
    });
    sellerStats.set(product.seller_id, stats);
  });

  const stores = (sellers ?? []).map((seller) => {
    const stats = sellerStats.get(seller.id) ?? {
      productCount: 0,
      reviewCount: 0,
      ratingTotal: 0,
    };
    const relationCount = (value: unknown) => {
      const row = Array.isArray(value) ? value[0] : value;
      return Number((row as { count?: number } | null)?.count ?? 0);
    };
    return {
      id: seller.id,
      display_name: seller.display_name,
      display_name_en: seller.display_name_en,
      slug: seller.slug,
      logo_url: seller.logo_url,
      cover_url: seller.cover_url,
      bio: seller.bio,
      seller_type: seller.seller_type,
      profile_completion: getSellerProfileCompletion({
        ...seller,
        has_documents: relationCount(seller.document_count) > 0,
        has_payout_account: relationCount(seller.payout_count) > 0,
      }),
      is_system_store: false,
      product_count: stats.productCount,
      view_count: viewCounts.get(seller.id) ?? 0,
      review_count: stats.reviewCount,
      average_rating: stats.reviewCount ? stats.ratingTotal / stats.reviewCount : 0,
      badges: badgesBySeller.get(seller.id) ?? [],
    };
  });

  const total = count ?? 0;
  return {
    stores,
    total,
    page,
    totalPages: total ? Math.ceil(total / limit) : 0,
    updatedAt: new Date().toISOString(),
  };
}

async function loadPublicStoreDirectory(search: string, page: number, limit: number) {
  const safeSearch = search.replace(/[^\p{L}\p{N}\s._-]/gu, '').trim();
  const { data, error } = await supabaseAdmin.rpc('marketplace_public_store_directory', {
    search_text: safeSearch,
    page_number: page,
    page_size: limit,
  });
  // Allow application rollout before the additive database migration is installed.
  if (error && ['42883', 'PGRST202'].includes(error.code)) {
    return loadLegacyPublicStoreDirectory(search, page, limit);
  }
  if (error) throw new Error(error.message);
  if (!data || !Array.isArray(data.stores)) throw new Error('Invalid store directory response');
  return { ...data, updatedAt: new Date().toISOString() } as Awaited<
    ReturnType<typeof loadLegacyPublicStoreDirectory>
  >;
}

// This directory contains only public store cards, never account or finance data.
export const getPublicStoreDirectory = unstable_cache(
  loadPublicStoreDirectory,
  ['public-store-directory-rpc-v2'],
  { revalidate: 60 }
);
