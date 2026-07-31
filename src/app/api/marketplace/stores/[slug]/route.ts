import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { withMediaUrls } from 'src/sections/marketplace/seller/server/product-media';
import { getSellerProfileCompletionById } from 'src/sections/marketplace/seller/server/seller-completion';
import {
  canViewSellerTools,
  SELLER_TOOLS_CATEGORY,
} from 'src/sections/marketplace/seller/server/seller-tools-access';

type Context = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  const { slug } = await params;
  const identifier = decodeURIComponent(slug);
  let { data: seller, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .select(
      'id, display_name, display_name_en, slug, logo_url, cover_url, bio, seller_type, owner_role'
    )
    .eq('slug', identifier)
    .eq('status', 'active')
    .maybeSingle();

  if (!seller && !error && /^[0-9a-f-]{36}$/i.test(identifier)) {
    const sellerById = await supabaseAdmin
      .from('marketplace_sellers')
      .select(
        'id, display_name, display_name_en, slug, logo_url, cover_url, bio, seller_type, owner_role'
      )
      .eq('id', identifier)
      .eq('status', 'active')
      .maybeSingle();
    seller = sellerById.data;
    error = sellerById.error;
  }

  if (error || !seller) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบร้านค้า' },
      { status: error ? 500 : 404 }
    );
  }
  const profileCompletion = await getSellerProfileCompletionById(seller.id);
  const { owner_role: ownerRole, ...sellerDetails } = seller;
  const publicSeller = {
    ...sellerDetails,
    profile_completion: profileCompletion,
    is_system_store: ownerRole === 'master_admin',
  };
  let productsQuery = supabaseAdmin
    .from('marketplace_products')
    .select(
      'id, seller_id, title, title_en, description, description_en, short_description, short_description_en, category, media_type_id, sale_type_id, resource_type, price, list_price, currency, cover_url, status, created_at, media_type:marketplace_media_types(id,name,delivery_mode), sale_type:marketplace_sale_types(id,name,pricing_mode), grade_levels:marketplace_product_grade_levels(grade_level:marketplace_grade_levels(id,name)), images:marketplace_product_images(*), reviews:marketplace_product_reviews(rating)'
    )
    .eq('seller_id', seller.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  if (!(await canViewSellerTools(caller?.sub))) {
    productsQuery = productsQuery.neq('category', SELLER_TOOLS_CATEGORY);
  }
  const { data: products, error: productError } = await productsQuery;
  if (productError) {
    return NextResponse.json({ message: productError.message }, { status: 500 });
  }
  const resolvedProducts = await Promise.all(
    (products ?? []).map(async (product) => {
      const resolved = await withMediaUrls({ ...product, files: [] });
      const ratings = (product.reviews ?? [])
        .map((review) => Number(review.rating))
        .filter((rating) => Number.isFinite(rating));
      const safeProduct: Record<string, unknown> = { ...resolved };
      delete safeProduct.reviews;
      delete safeProduct.files;
      return {
        ...safeProduct,
        seller: publicSeller,
        engagement: {
          views: 0,
          likes: 0,
          purchases: 0,
          downloads: 0,
          reviewCount: ratings.length,
          averageRating: ratings.length
            ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
            : 0,
          reviews: [],
          canReview: false,
          canReply: false,
          myReview: null,
        },
      };
    })
  );
  return NextResponse.json({ seller: publicSeller, products: resolvedProducts });
}
