import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

export type MarketplaceProductReview = {
  id: string;
  rating: number;
  comment: string | null;
  reviewer_name: string;
  created_at: string;
  updated_at: string;
};

export type MarketplaceProductEngagement = {
  views: number;
  purchases: number;
  downloads: number;
  reviewCount: number;
  averageRating: number;
  reviews: MarketplaceProductReview[];
  canReview: boolean;
  myReview: MarketplaceProductReview | null;
};

export type MarketplaceProductPurchaseAccess = {
  canPurchase: boolean;
  hasPurchased: boolean;
  accessExpiresAt: string | null;
  message: string | null;
};

type PurchasedItem = {
  quantity: number;
};

function toPublicReview(
  review: MarketplaceProductReview & { buyer_id: string }
): MarketplaceProductReview {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    reviewer_name: review.reviewer_name,
    created_at: review.created_at,
    updated_at: review.updated_at,
  };
}

export async function hasPurchasedProduct(productId: string, buyerId: string) {
  const { data, error } = await supabaseAdmin
    .from('marketplace_order_items')
    .select('id, order:marketplace_orders!inner(id)')
    .eq('product_id', productId)
    .eq('order.buyer_id', buyerId)
    .in('order.status', ['paid', 'completed'])
    .limit(1);

  return !error && Boolean(data?.length);
}

export async function getProductPurchaseAccess({
  productId,
  buyerId,
  schoolId,
  resourceType,
}: {
  productId: string;
  buyerId?: string;
  schoolId?: string | null;
  resourceType: string;
}): Promise<MarketplaceProductPurchaseAccess> {
  if (!buyerId) {
    return {
      canPurchase: true,
      hasPurchased: false,
      accessExpiresAt: null,
      message: null,
    };
  }

  if (resourceType === 'feature_unlock') {
    if (!schoolId) {
      return {
        canPurchase: false,
        hasPurchased: false,
        accessExpiresAt: null,
        message: 'สินค้านี้ซื้อได้เฉพาะบัญชีผู้ดูแลโรงเรียน',
      };
    }
    const { data: licenses } = await supabaseAdmin
      .from('marketplace_school_licenses')
      .select('expires_at')
      .eq('school_id', schoolId)
      .eq('product_id', productId)
      .eq('status', 'active')
      .order('expires_at', { ascending: false })
      .limit(1);
    const expiresAt = licenses?.[0]?.expires_at ?? null;
    const isActive = Boolean(expiresAt && new Date(expiresAt).getTime() > Date.now());
    return {
      canPurchase: !isActive,
      hasPurchased: Boolean(licenses?.length),
      accessExpiresAt: expiresAt,
      message: isActive ? 'สิทธิ์ Subscription นี้ยังใช้งานอยู่' : null,
    };
  }

  const hasPurchased = await hasPurchasedProduct(productId, buyerId);
  return {
    canPurchase: !hasPurchased,
    hasPurchased,
    accessExpiresAt: null,
    message: hasPurchased ? 'คุณซื้อสินค้านี้แล้ว สามารถดาวน์โหลดได้จากรายการซื้อ' : null,
  };
}

export async function getProductEngagement(
  productId: string,
  buyerId?: string
): Promise<MarketplaceProductEngagement> {
  const [viewsResult, downloadsResult, purchasesResult, reviewsResult, canReview] =
    await Promise.all([
      supabaseAdmin
        .from('marketplace_product_views')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId),
      supabaseAdmin
        .from('marketplace_product_downloads')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId),
      supabaseAdmin
        .from('marketplace_order_items')
        .select('quantity, order:marketplace_orders!inner(status)')
        .eq('product_id', productId)
        .in('order.status', ['paid', 'completed']),
      supabaseAdmin
        .from('marketplace_product_reviews')
        .select('id, buyer_id, rating, comment, reviewer_name, created_at, updated_at')
        .eq('product_id', productId)
        .order('updated_at', { ascending: false }),
      buyerId ? hasPurchasedProduct(productId, buyerId) : Promise.resolve(false),
    ]);

  const reviewRows = (reviewsResult.data ?? []) as Array<
    MarketplaceProductReview & { buyer_id: string }
  >;
  const reviews = reviewRows.map(toPublicReview);
  const ratingTotal = reviews.reduce((sum, review) => sum + Number(review.rating), 0);
  const purchases = ((purchasesResult.data ?? []) as unknown as PurchasedItem[]).reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  return {
    views: viewsResult.count ?? 0,
    purchases,
    downloads: downloadsResult.count ?? 0,
    reviewCount: reviews.length,
    averageRating: reviews.length ? ratingTotal / reviews.length : 0,
    reviews: reviews.slice(0, 20),
    canReview,
    myReview: buyerId
      ? (() => {
          const ownReview = reviewRows.find((review) => review.buyer_id === buyerId);
          return ownReview ? toPublicReview(ownReview) : null;
        })()
      : null,
  };
}
