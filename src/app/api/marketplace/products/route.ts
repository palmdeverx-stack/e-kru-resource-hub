import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { provisionEkruSystemSeller } from 'src/sections/marketplace/seller/server/system-seller';
import { withPublicSystemStoreFlag } from 'src/sections/marketplace/seller/server/public-seller';
import {
  withMediaUrls,
  PRODUCT_MANAGE_SELECT,
} from 'src/sections/marketplace/seller/server/product-media';

function withCardRating(product: Record<string, unknown>): Record<string, unknown> {
  const reviews = Array.isArray(product.reviews)
    ? (product.reviews as Array<{ rating?: number }>)
    : [];
  const ratings = reviews
    .map((review: { rating?: number }) => Number(review.rating))
    .filter((rating: number) => Number.isFinite(rating));
  const safeProduct = { ...product };
  delete safeProduct.reviews;
  return {
    ...safeProduct,
    engagement: {
      views: 0,
      purchases: 0,
      downloads: 0,
      reviewCount: ratings.length,
      averageRating: ratings.length
        ? ratings.reduce((sum: number, rating: number) => sum + rating, 0) / ratings.length
        : 0,
      reviews: [],
      canReview: false,
      canReply: false,
      myReview: null,
    },
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mine = url.searchParams.get('mine') === '1';
  const official = url.searchParams.get('official') === '1';
  const bestSeller = url.searchParams.get('bestSeller') === '1';
  const category = url.searchParams.get('category');
  const requestedSellerId = url.searchParams.get('sellerId')?.trim();
  const search = url.searchParams.get('q')?.trim();
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(
    48,
    Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '48', 10) || 48)
  );
  const offset = (page - 1) * limit;

  let sellerId: string | null = null;
  if (mine) {
    const caller = requireAuthenticated(request);
    if (!caller) {
      return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const { data: seller } = await supabaseAdmin
      .from('marketplace_sellers')
      .select('id')
      .eq('owner_id', caller.sub)
      .maybeSingle();
    sellerId = seller?.id ?? null;
    if (!sellerId) return NextResponse.json({ products: [] });
  }

  let officialSellerIds: string[] | null = null;
  if (!mine && official) {
    const { data: officialSellers, error: officialSellersError } = await supabaseAdmin
      .from('marketplace_sellers')
      .select('id')
      .eq('owner_role', 'master_admin')
      .eq('status', 'active');

    if (officialSellersError) {
      if (officialSellersError.code === '42P01') {
        return NextResponse.json({ products: [], setupRequired: true });
      }
      return NextResponse.json({ message: officialSellersError.message }, { status: 500 });
    }

    officialSellerIds = (officialSellers ?? []).map((seller) => seller.id);
    if (!officialSellerIds.length) {
      return NextResponse.json({ products: [], hasMore: false, nextPage: null });
    }
  }

  const purchaseCounts = new Map<string, number>();
  let bestSellingProductIds: string[] | null = null;
  if (!mine && bestSeller) {
    const { data: purchasedItems, error: purchasedItemsError } = await supabaseAdmin
      .from('marketplace_order_items')
      .select(
        'product_id, quantity, order:marketplace_orders!inner(status), product:marketplace_products!inner(status, seller:marketplace_sellers!inner(owner_role, status))'
      )
      .in('order.status', ['paid', 'completed'])
      .eq('product.status', 'published')
      .neq('product.seller.owner_role', 'master_admin')
      .eq('product.seller.status', 'active');

    if (purchasedItemsError) {
      if (purchasedItemsError.code === '42P01') {
        return NextResponse.json({ products: [], setupRequired: true });
      }
      return NextResponse.json({ message: purchasedItemsError.message }, { status: 500 });
    }

    (purchasedItems ?? []).forEach((item) => {
      purchaseCounts.set(
        item.product_id,
        (purchaseCounts.get(item.product_id) ?? 0) + Number(item.quantity || 0)
      );
    });
    bestSellingProductIds = [...purchaseCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([productId]) => productId);

    if (!bestSellingProductIds.length) {
      return NextResponse.json({ products: [], hasMore: false, nextPage: null });
    }
  }

  let query = supabaseAdmin
    .from('marketplace_products')
    .select(
      '*, seller:marketplace_sellers(id, display_name, display_name_en, seller_type, slug, logo_url, bio, owner_role), media_type:marketplace_media_types(id, name, delivery_mode), sale_type:marketplace_sale_types(id, name, pricing_mode), grade_levels:marketplace_product_grade_levels(grade_level:marketplace_grade_levels(id,name)), images:marketplace_product_images(*), reviews:marketplace_product_reviews(rating)'
    )
    .order('created_at', { ascending: false });

  query = mine ? query.eq('seller_id', sellerId) : query.eq('status', 'published');
  if (officialSellerIds) query = query.in('seller_id', officialSellerIds);
  if (bestSellingProductIds) {
    query = query.in('id', bestSellingProductIds.slice(0, offset + limit + 1));
  }
  if (!mine && requestedSellerId) query = query.eq('seller_id', requestedSellerId);
  if (category && category !== 'all') query = query.eq('category', category);
  if (search) {
    const safeSearch = search.replace(/[^\p{L}\p{N}\s_-]/gu, '').trim();
    if (safeSearch) {
      query = query.or(`title.ilike.%${safeSearch}%,title_en.ilike.%${safeSearch}%`);
    }
  }
  if (!bestSellingProductIds) query = query.range(offset, offset + limit);

  const { data: products, error } = await query;

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ products: [], setupRequired: true });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const rows = products ?? [];
  const orderedRows = bestSellingProductIds
    ? bestSellingProductIds
        .map((productId) => rows.find((product) => product.id === productId))
        .filter((product): product is NonNullable<typeof product> => Boolean(product))
    : rows;
  const pagedRows = bestSellingProductIds
    ? orderedRows.slice(offset, offset + limit + 1)
    : orderedRows;
  const hasMore = pagedRows.length > limit;
  const pageRows = pagedRows.slice(0, limit);
  const resolved = await Promise.all(pageRows.map((product) => withMediaUrls(product)));
  const safeProducts = resolved.map((resolvedProduct) => {
    const product = withCardRating(resolvedProduct);
    if (bestSellingProductIds && product.engagement && typeof product.engagement === 'object') {
      product.engagement = {
        ...(product.engagement as Record<string, unknown>),
        purchases: purchaseCounts.get(String(product.id)) ?? 0,
      };
    }
    product.seller = withPublicSystemStoreFlag(product.seller);
    if (mine) return product;
    const publicProduct = { ...product };
    delete publicProduct.file_url;
    delete publicProduct.files;
    return publicProduct;
  });
  return NextResponse.json({
    products: safeProducts,
    hasMore,
    nextPage: hasMore ? page + 1 : null,
  });
}

export async function POST(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  let { data: seller } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, status')
    .eq('owner_id', caller.sub)
    .maybeSingle();

  if (!seller && caller.role === 'master_admin') {
    const systemSellerResult = await provisionEkruSystemSeller(caller.sub);
    seller = systemSellerResult.data
      ? { id: systemSellerResult.data.id, status: systemSellerResult.data.status }
      : null;
  }

  if (!seller) {
    return NextResponse.json(
      { message: 'กรุณาส่งคำขอเปิดร้านและรอผู้ดูแลระบบอนุมัติก่อนลงสินค้า' },
      { status: 403 }
    );
  }
  if (seller.status !== 'active') {
    const message =
      seller.status === 'pending'
        ? 'คำขอเปิดร้านกำลังรอผู้ดูแลระบบอนุมัติ'
        : seller.status === 'rejected'
          ? 'คำขอเปิดร้านไม่ผ่าน กรุณาแก้ไขข้อมูลและส่งคำขอใหม่'
          : 'ร้านถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
    return NextResponse.json({ message }, { status: 403 });
  }

  const body = await request.json();
  const title = String(body.title ?? '').trim();
  if (title.length < 3) {
    return NextResponse.json(
      { message: 'กรุณากรอกชื่อสินค้าอย่างน้อย 3 ตัวอักษร' },
      { status: 400 }
    );
  }
  const shortDescription = String(body.shortDescription ?? '').trim();
  if (shortDescription.length > 150) {
    return NextResponse.json({ message: 'คำอธิบายสั้นต้องไม่เกิน 150 ตัวอักษร' }, { status: 400 });
  }
  const description = String(body.description ?? '').trim();
  const titleEn = String(body.titleEn ?? '').trim();
  const shortDescriptionEn = String(body.shortDescriptionEn ?? '').trim();
  if (shortDescriptionEn.length > 150) {
    return NextResponse.json(
      { message: 'คำอธิบายสั้นภาษาอังกฤษต้องไม่เกิน 150 ตัวอักษร' },
      { status: 400 }
    );
  }
  const descriptionEn = String(body.descriptionEn ?? '').trim();

  const { data: product, error } = await supabaseAdmin
    .from('marketplace_products')
    .insert({
      seller_id: seller.id,
      title,
      title_en: titleEn || null,
      short_description: shortDescription || null,
      short_description_en: shortDescriptionEn || null,
      description,
      description_en: descriptionEn || null,
      status: 'draft',
      wizard_step: 1,
    })
    .select(PRODUCT_MANAGE_SELECT)
    .single();

  if (error || !product) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถลงสินค้าได้' },
      { status: 500 }
    );
  }

  return NextResponse.json({ product: await withMediaUrls(product) }, { status: 201 });
}
