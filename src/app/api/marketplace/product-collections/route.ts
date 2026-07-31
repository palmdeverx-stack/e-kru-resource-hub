import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { withMediaUrls } from 'src/sections/marketplace/seller/server/product-media';
import { withPublicSystemStoreFlag } from 'src/sections/marketplace/seller/server/public-seller';
import {
  canViewSellerTools,
  SELLER_TOOLS_CATEGORY,
} from 'src/sections/marketplace/seller/server/seller-tools-access';

const PRODUCT_SELECT =
  'id, seller_id, title, title_en, description, description_en, short_description, short_description_en, category, media_type_id, sale_type_id, resource_type, price, list_price, currency, cover_url, status, created_at, seller:marketplace_sellers(id, display_name, display_name_en, seller_type, slug, logo_url, bio, owner_role), media_type:marketplace_media_types(id, name, delivery_mode), sale_type:marketplace_sale_types(id, name, pricing_mode), grade_levels:marketplace_product_grade_levels(grade_level:marketplace_grade_levels(id,name)), images:marketplace_product_images(*), reviews:marketplace_product_reviews(rating)';

type CollectionType = 'favorite' | 'bookmark';

function isMissingTable(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

async function resolveProducts(productIds: string[], sellerToolsVisible: boolean) {
  if (!productIds.length) return [];

  let query = supabaseAdmin
    .from('marketplace_products')
    .select(PRODUCT_SELECT)
    .in('id', productIds)
    .eq('status', 'published');
  if (!sellerToolsVisible) query = query.neq('category', SELLER_TOOLS_CATEGORY);
  const { data, error } = await query;

  if (error) throw error;

  const products = await Promise.all(
    (data ?? []).map(async (product) => {
      const resolved = await withMediaUrls({ ...product, files: [] });
      const ratings = (product.reviews ?? [])
        .map((review) => Number(review.rating))
        .filter((rating) => Number.isFinite(rating));
      const safeProduct: Record<string, unknown> = { ...resolved };
      delete safeProduct.reviews;
      delete safeProduct.files;
      safeProduct.seller = withPublicSystemStoreFlag(safeProduct.seller);

      const productWithEngagement: Record<string, unknown> = {
        ...safeProduct,
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
      return productWithEngagement;
    })
  );
  const productMap = new Map(products.map((product) => [String(product.id), product]));

  return productIds.flatMap((id) => {
    const product = productMap.get(id);
    return product ? [product] : [];
  });
}

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const productId = new URL(request.url).searchParams.get('productId');
  const { data, error } = await supabaseAdmin
    .from('marketplace_product_collections')
    .select('product_id, collection_type, created_at')
    .eq('user_id', caller.sub)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({
        favorites: [],
        bookmarks: [],
        preference: { favorite: false, bookmark: false },
        setupRequired: true,
      });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  if (productId) {
    const selected = (data ?? []).filter((item) => item.product_id === productId);
    return NextResponse.json({
      preference: {
        favorite: selected.some((item) => item.collection_type === 'favorite'),
        bookmark: selected.some((item) => item.collection_type === 'bookmark'),
      },
    });
  }

  const favoriteIds = (data ?? [])
    .filter((item) => item.collection_type === 'favorite')
    .map((item) => item.product_id);
  const bookmarkIds = (data ?? [])
    .filter((item) => item.collection_type === 'bookmark')
    .map((item) => item.product_id);
  const products = await resolveProducts(
    [...new Set([...favoriteIds, ...bookmarkIds])],
    await canViewSellerTools(caller.sub)
  );
  const productMap = new Map(products.map((product) => [String(product.id), product]));

  return NextResponse.json({
    favorites: favoriteIds.flatMap((id) => {
      const product = productMap.get(id);
      return product ? [product] : [];
    }),
    bookmarks: bookmarkIds.flatMap((id) => {
      const product = productMap.get(id);
      return product ? [product] : [];
    }),
  });
}

export async function PUT(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const body = await request.json();
  const productId = String(body.productId ?? '');
  const collectionType = String(body.collectionType ?? '') as CollectionType;
  const active = body.active === true;

  if (!/^[0-9a-f-]{36}$/i.test(productId)) {
    return NextResponse.json({ message: 'รหัสสินค้าไม่ถูกต้อง' }, { status: 400 });
  }
  if (!['favorite', 'bookmark'].includes(collectionType)) {
    return NextResponse.json({ message: 'ประเภทรายการไม่ถูกต้อง' }, { status: 400 });
  }

  const result = active
    ? await supabaseAdmin.from('marketplace_product_collections').upsert(
        {
          user_id: caller.sub,
          product_id: productId,
          collection_type: collectionType,
        },
        { onConflict: 'user_id,product_id,collection_type' }
      )
    : await supabaseAdmin
        .from('marketplace_product_collections')
        .delete()
        .eq('user_id', caller.sub)
        .eq('product_id', productId)
        .eq('collection_type', collectionType);

  if (result.error) {
    return NextResponse.json(
      {
        message: isMissingTable(result.error)
          ? 'กรุณาติดตั้ง migration สำหรับรายการโปรดก่อน'
          : result.error.message,
      },
      { status: isMissingTable(result.error) ? 503 : 500 }
    );
  }

  return NextResponse.json({ active });
}
