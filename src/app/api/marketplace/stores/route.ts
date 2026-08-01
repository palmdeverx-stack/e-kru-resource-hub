import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';

import { getPublicSellerBadges } from 'src/sections/marketplace/seller/server/seller-badges';
import { getSellerProfileCompletionById } from 'src/sections/marketplace/seller/server/seller-completion';

type ProductRatingRow = {
  seller_id: string;
  reviews?: Array<{ rating?: number | null }> | null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get('q')?.trim() ?? '';
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(
    48,
    Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '24', 10) || 24)
  );
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('marketplace_sellers')
    .select(
      'id, display_name, display_name_en, slug, logo_url, cover_url, bio, seller_type, owner_role',
      { count: 'exact' }
    )
    .eq('status', 'active')
    .order('display_name', { ascending: true })
    .range(offset, offset + limit - 1);

  const safeSearch = search.replace(/[^\p{L}\p{N}\s._-]/gu, '').trim();
  if (safeSearch) {
    query = query.or(
      `display_name.ilike.%${safeSearch}%,display_name_en.ilike.%${safeSearch}%`
    );
  }

  const { data: sellers, error, count } = await query;
  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ stores: [], total: 0, page, totalPages: 0 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const sellerIds = (sellers ?? []).map((seller) => seller.id);
  const { data: productRows, error: productError } = sellerIds.length
    ? await supabaseAdmin
        .from('marketplace_products')
        .select('seller_id, reviews:marketplace_product_reviews(rating)')
        .in('seller_id', sellerIds)
        .eq('status', 'published')
    : { data: [], error: null };

  if (productError) {
    return NextResponse.json({ message: productError.message }, { status: 500 });
  }
  const badgesBySeller = await getPublicSellerBadges(sellerIds);

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

  const stores = await Promise.all(
    (sellers ?? []).map(async (seller) => {
      const stats = sellerStats.get(seller.id) ?? {
        productCount: 0,
        reviewCount: 0,
        ratingTotal: 0,
      };
      const { owner_role: ownerRole, ...publicSeller } = seller;
      return {
        ...publicSeller,
        profile_completion: await getSellerProfileCompletionById(seller.id),
        is_system_store: ownerRole === 'master_admin',
        product_count: stats.productCount,
        review_count: stats.reviewCount,
        average_rating: stats.reviewCount ? stats.ratingTotal / stats.reviewCount : 0,
        badges: badgesBySeller.get(seller.id) ?? [],
      };
    })
  );

  const total = count ?? 0;
  return NextResponse.json({
    stores,
    total,
    page,
    totalPages: total ? Math.ceil(total / limit) : 0,
  });
}
