import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { provisionEkruSystemSeller } from 'src/sections/marketplace/seller/server/system-seller';
import { withPublicSystemStoreFlag } from 'src/sections/marketplace/seller/server/public-seller';
import {
  withMediaUrls,
  PRODUCT_MANAGE_SELECT,
} from 'src/sections/marketplace/seller/server/product-media';
import {
  canViewSellerTools,
  SELLER_TOOLS_CATEGORY,
} from 'src/sections/marketplace/seller/server/seller-tools-access';

type ProductEngagementCount = {
  product_id: string;
  views: number | string;
  likes?: number | string;
  purchases: number | string;
};

async function recordProductSearch(
  queryText: string,
  products: Array<{ id: string; seller_id: string }>
) {
  if (queryText.length < 2) return;

  try {
    const { data: event, error: eventError } = await supabaseAdmin
      .from('marketplace_search_events')
      .insert({
        query_text: queryText.slice(0, 120),
        normalized_query: queryText.toLocaleLowerCase('th-TH').slice(0, 120),
        result_count: products.length,
      })
      .select('id')
      .single();
    if (eventError || !event || !products.length) return;

    const uniqueProducts = [
      ...new Map(products.map((product) => [product.id, product])).values(),
    ];
    await supabaseAdmin.from('marketplace_search_event_products').insert(
      uniqueProducts.map((product, index) => ({
        search_event_id: event.id,
        product_id: product.id,
        seller_id: product.seller_id,
        position: index + 1,
      }))
    );
  } catch {
    // Search analytics must never interrupt the product catalog.
  }
}

function withCardRating(
  product: Record<string, unknown>,
  counts?: ProductEngagementCount
): Record<string, unknown> {
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
      views: Number(counts?.views ?? 0),
      likes: Number(counts?.likes ?? 0),
      purchases: Number(counts?.purchases ?? 0),
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
  const caller = requireAuthenticated(request);
  const url = new URL(request.url);
  const mine = url.searchParams.get('mine') === '1';
  const official = url.searchParams.get('official') === '1';
  const bestSeller = url.searchParams.get('bestSeller') === '1';
  const priceFilter = url.searchParams.get('price');
  const requestedGradeGroup = url.searchParams.get('grade');
  const gradeGroup = ['kindergarten', 'primary', 'secondary'].includes(requestedGradeGroup ?? '')
    ? requestedGradeGroup
    : null;
  const category = url.searchParams.get('category');
  const requestedSellerId = url.searchParams.get('sellerId')?.trim();
  const search = url.searchParams.get('q')?.trim();
  const requestedStatus = url.searchParams.get('status');
  const mineStatus = ['draft', 'pending_review', 'published', 'rejected', 'archived'].includes(
    requestedStatus ?? ''
  )
    ? requestedStatus
    : null;
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(
    48,
    Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '48', 10) || 48)
  );
  const offset = (page - 1) * limit;

  let gradeLevelIds: string[] | null = null;
  if (gradeGroup) {
    let gradeLevelQuery = supabaseAdmin.from('marketplace_grade_levels').select('id');

    if (gradeGroup === 'kindergarten') {
      gradeLevelQuery = gradeLevelQuery.or('code.ilike.k%,code.ilike.kg%,name.ilike.%อนุบาล%');
    } else if (gradeGroup === 'primary') {
      gradeLevelQuery = gradeLevelQuery.ilike('code', 'p%');
    } else {
      gradeLevelQuery = gradeLevelQuery.ilike('code', 'm%');
    }

    const { data: gradeLevels, error: gradeLevelsError } = await gradeLevelQuery;
    if (gradeLevelsError) {
      if (gradeLevelsError.code === '42P01') {
        return NextResponse.json({ products: [], setupRequired: true });
      }
      return NextResponse.json({ message: gradeLevelsError.message }, { status: 500 });
    }

    gradeLevelIds = (gradeLevels ?? []).map((gradeLevel) => gradeLevel.id);
    if (!gradeLevelIds.length) {
      return NextResponse.json({ products: [], hasMore: false, nextPage: null });
    }
  }

  let sellerId: string | null = null;
  if (mine) {
    if (!caller) {
      return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const { data: seller } = await supabaseAdmin
      .from('marketplace_sellers')
      .select('id')
      .eq('owner_id', caller.sub)
      .maybeSingle();
    sellerId = seller?.id ?? null;
    if (!sellerId) {
      return NextResponse.json({
        products: [],
        hasMore: false,
        nextPage: null,
        pagination: { page, limit, total: 0, totalPages: 0 },
        counts: { all: 0, draft: 0, pending_review: 0, published: 0, rejected: 0, archived: 0 },
      });
    }
  }
  const sellerToolsVisible = await canViewSellerTools(caller?.sub);

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

  const gradeLevelsSelect = gradeLevelIds
    ? 'grade_levels:marketplace_product_grade_levels!inner(grade_level_id,grade_level:marketplace_grade_levels(id,name))'
    : 'grade_levels:marketplace_product_grade_levels(grade_level:marketplace_grade_levels(id,name))';

  let safeSearch = '';
  let tagMatchedProductIds: string[] = [];
  if (search) {
    safeSearch = search.replace(/[^\p{L}\p{N}\s_-]/gu, '').trim();
    if (safeSearch) {
      const { data: matchedTags, error: matchedTagsError } = await supabaseAdmin
        .from('marketplace_tags')
        .select('id')
        .eq('is_active', true)
        .ilike('name', `%${safeSearch}%`);
      if (matchedTagsError) {
        return NextResponse.json({ message: matchedTagsError.message }, { status: 500 });
      }
      if (matchedTags?.length) {
        const { data: taggedProducts, error: taggedProductsError } = await supabaseAdmin
          .from('marketplace_product_tags')
          .select('product_id')
          .in(
            'tag_id',
            matchedTags.map((tag) => tag.id)
          );
        if (taggedProductsError) {
          return NextResponse.json({ message: taggedProductsError.message }, { status: 500 });
        }
        tagMatchedProductIds = [...new Set((taggedProducts ?? []).map((row) => row.product_id))];
      }
    }
  }

  let query = supabaseAdmin
    .from('marketplace_products')
    .select(
      `*, seller:marketplace_sellers(id, display_name, display_name_en, seller_type, slug, logo_url, bio, owner_role), media_type:marketplace_media_types(id, name, delivery_mode), sale_type:marketplace_sale_types(id, name, pricing_mode), ${gradeLevelsSelect}, images:marketplace_product_images(*), reviews:marketplace_product_reviews(rating)`,
      { count: mine ? 'exact' : undefined }
    )
    .order('created_at', { ascending: false });

  query = mine ? query.eq('seller_id', sellerId) : query.eq('status', 'published');
  if (mine && mineStatus) query = query.eq('status', mineStatus);
  if (!mine && !sellerToolsVisible) query = query.neq('category', SELLER_TOOLS_CATEGORY);
  if (officialSellerIds) query = query.in('seller_id', officialSellerIds);
  if (bestSellingProductIds) {
    query = query.in('id', bestSellingProductIds.slice(0, offset + limit + 1));
  }
  if (!mine && requestedSellerId) query = query.eq('seller_id', requestedSellerId);
  if (category && category !== 'all') query = query.eq('category', category);
  if (gradeLevelIds) query = query.in('grade_levels.grade_level_id', gradeLevelIds);
  if (priceFilter === 'free') query = query.eq('price', 0);
  if (priceFilter === 'paid') query = query.gt('price', 0);
  if (safeSearch) {
    const filters = [
      `title.ilike.%${safeSearch}%`,
      `title_en.ilike.%${safeSearch}%`,
      `category.ilike.%${safeSearch}%`,
    ];
    if (tagMatchedProductIds.length) {
      filters.push(`id.in.(${tagMatchedProductIds.join(',')})`);
    }
    query = query.or(filters.join(','));
  }
  if (!bestSellingProductIds) query = query.range(offset, offset + limit);

  const [{ data: products, error, count: exactProductCount }, mineCountResults] = await Promise.all(
    [
      query,
      mine
        ? Promise.all(
            ['draft', 'pending_review', 'published', 'rejected', 'archived'].map((status) =>
              supabaseAdmin
                .from('marketplace_products')
                .select('id', { count: 'exact', head: true })
                .eq('seller_id', sellerId)
                .eq('status', status)
            )
          )
        : Promise.resolve([]),
    ]
  );

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ products: [], setupRequired: true });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  const mineCountError = mineCountResults.find((result) => result.error)?.error;
  if (mineCountError) {
    return NextResponse.json({ message: mineCountError.message }, { status: 500 });
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
  const searchTrackingPromise =
    !mine && page === 1 && safeSearch.length >= 2
      ? recordProductSearch(
          safeSearch,
          pageRows.map((product) => ({ id: product.id, seller_id: product.seller_id }))
        )
      : Promise.resolve();
  const engagementCounts = new Map<string, ProductEngagementCount>();
  if (pageRows.length) {
    const productIds = pageRows.map((product) => product.id);
    const [{ data: countRows, error: countError }, { data: favoriteRows, error: favoriteError }] =
      await Promise.all([
        supabaseAdmin.rpc('marketplace_product_engagement_counts', {
          product_ids: productIds,
        }),
        supabaseAdmin
          .from('marketplace_product_collections')
          .select('product_id')
          .eq('collection_type', 'favorite')
          .in('product_id', productIds),
      ]);
    if (countError || favoriteError) {
      return NextResponse.json(
        {
          message: countError?.message ?? favoriteError?.message,
          setupRequired:
            countError?.code === '42883' ||
            countError?.code === 'PGRST202' ||
            favoriteError?.code === '42P01',
        },
        { status: 500 }
      );
    }
    ((countRows ?? []) as ProductEngagementCount[]).forEach((count) => {
      engagementCounts.set(count.product_id, count);
    });
    (favoriteRows ?? []).forEach(({ product_id: productId }) => {
      const count = engagementCounts.get(productId);
      if (count) count.likes = Number(count.likes ?? 0) + 1;
    });
  }
  const mineUsage = new Map<
    string,
    { purchases: number; hasOrderReferences: boolean; hasDealReferences: boolean }
  >();
  if (mine && pageRows.length) {
    const productIds = pageRows.map((product) => product.id);
    const [{ data: orderItems, error: orderItemsError }, { data: deals, error: dealsError }] =
      await Promise.all([
        supabaseAdmin
          .from('marketplace_order_items')
          .select('product_id, quantity, order:marketplace_orders!inner(status)')
          .in('product_id', productIds),
        supabaseAdmin
          .from('marketplace_sales_deals')
          .select('product_id')
          .in('product_id', productIds),
      ]);
    if (orderItemsError || dealsError) {
      return NextResponse.json(
        { message: orderItemsError?.message ?? dealsError?.message ?? 'โหลดสถานะสินค้าไม่สำเร็จ' },
        { status: 500 }
      );
    }
    productIds.forEach((productId) => {
      mineUsage.set(productId, {
        purchases: 0,
        hasOrderReferences: false,
        hasDealReferences: false,
      });
    });
    (orderItems ?? []).forEach((item) => {
      const usage = mineUsage.get(item.product_id);
      if (!usage) return;
      usage.hasOrderReferences = true;
      const order = Array.isArray(item.order) ? item.order[0] : item.order;
      if (order && ['paid', 'completed', 'refunded'].includes(String(order.status))) {
        usage.purchases += Number(item.quantity || 0);
      }
    });
    (deals ?? []).forEach((deal) => {
      const usage = mineUsage.get(deal.product_id);
      if (usage) usage.hasDealReferences = true;
    });
  }
  const resolved = await Promise.all(pageRows.map((product) => withMediaUrls(product)));
  const safeProducts = resolved.map((resolvedProduct) => {
    const product = withCardRating(
      resolvedProduct,
      engagementCounts.get(String(resolvedProduct.id))
    );
    if (bestSellingProductIds && product.engagement && typeof product.engagement === 'object') {
      product.engagement = {
        ...(product.engagement as Record<string, unknown>),
        purchases: purchaseCounts.get(String(product.id)) ?? 0,
      };
    }
    product.seller = withPublicSystemStoreFlag(product.seller);
    if (mine) {
      const usage = mineUsage.get(String(product.id)) ?? {
        purchases: 0,
        hasOrderReferences: false,
        hasDealReferences: false,
      };
      return {
        ...product,
        purchase_count: usage.purchases,
        has_order_references: usage.hasOrderReferences,
        has_deal_references: usage.hasDealReferences,
        can_delete: usage.purchases === 0 && !usage.hasOrderReferences && !usage.hasDealReferences,
        can_hide: product.status === 'published',
      };
    }
    const publicProduct = { ...product };
    delete publicProduct.file_url;
    delete publicProduct.files;
    delete publicProduct.external_links;
    delete publicProduct.purchase_benefits_html;
    return publicProduct;
  });
  const total = mine ? (exactProductCount ?? 0) : 0;
  const statusNames = ['draft', 'pending_review', 'published', 'rejected', 'archived'] as const;
  const counts = statusNames.reduce(
    (result, status, index) => {
      result[status] = mineCountResults[index]?.count ?? 0;
      return result;
    },
    { all: 0, draft: 0, pending_review: 0, published: 0, rejected: 0, archived: 0 } as Record<
      (typeof statusNames)[number] | 'all',
      number
    >
  );
  counts.all = statusNames.reduce((sum, status) => sum + counts[status], 0);
  await searchTrackingPromise;
  return NextResponse.json({
    products: safeProducts,
    hasMore,
    nextPage: hasMore ? page + 1 : null,
    ...(mine
      ? {
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
          counts,
        }
      : {}),
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
