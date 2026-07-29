import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';

import { withMediaUrls } from 'src/sections/marketplace/seller/server/product-media';

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { slug } = await params;
  const { data: seller, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, display_name, display_name_en, slug, logo_url, cover_url, bio, seller_type')
    .eq('slug', decodeURIComponent(slug))
    .eq('status', 'active')
    .maybeSingle();
  if (error || !seller) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบร้านค้า' },
      { status: error ? 500 : 404 }
    );
  }
  const { data: products, error: productError } = await supabaseAdmin
    .from('marketplace_products')
    .select(
      'id, seller_id, title, title_en, description, description_en, short_description, short_description_en, category, media_type_id, sale_type_id, resource_type, price, currency, cover_url, status, created_at, media_type:marketplace_media_types(id,name,delivery_mode), sale_type:marketplace_sale_types(id,name,pricing_mode), grade_levels:marketplace_product_grade_levels(grade_level:marketplace_grade_levels(id,name)), images:marketplace_product_images(*), reviews:marketplace_product_reviews(rating)'
    )
    .eq('seller_id', seller.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false });
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
        seller,
        engagement: {
          views: 0,
          purchases: 0,
          downloads: 0,
          reviewCount: ratings.length,
          averageRating: ratings.length
            ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
            : 0,
          reviews: [],
          canReview: false,
          myReview: null,
        },
      };
    })
  );
  return NextResponse.json({ seller, products: resolvedProducts });
}
