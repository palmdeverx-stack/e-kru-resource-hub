import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

import { MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY } from '../../seller/line-feature';

export type MarketplaceProductReview = {
  id: string;
  rating: number;
  comment: string | null;
  reviewer_name: string;
  images: Array<{ id: string; url: string }>;
  reply: {
    id: string;
    responder_name: string;
    comment: string;
    created_at: string;
    updated_at: string;
  } | null;
  created_at: string;
  updated_at: string;
};

export type MarketplaceProductEngagement = {
  views: number;
  likes: number;
  purchases: number;
  downloads: number;
  reviewCount: number;
  averageRating: number;
  reviews: MarketplaceProductReview[];
  canReview: boolean;
  canReply: boolean;
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

type ReviewRow = Omit<MarketplaceProductReview, 'images' | 'reply'> & {
  buyer_id: string;
  images?: Array<{
    id: string;
    storage_bucket: string;
    storage_path: string;
    position: number;
  }>;
  reply?:
    | MarketplaceProductReview['reply']
    | Array<NonNullable<MarketplaceProductReview['reply']>>
    | null;
};

async function toPublicReview(review: ReviewRow): Promise<MarketplaceProductReview> {
  const images = await Promise.all(
    (review.images ?? []).map(async (image) => {
      const { data } = await supabaseAdmin.storage
        .from(image.storage_bucket)
        .createSignedUrl(image.storage_path, 60 * 60);
      return data?.signedUrl ? { id: image.id, url: data.signedUrl } : null;
    })
  );
  const reply = Array.isArray(review.reply) ? (review.reply[0] ?? null) : (review.reply ?? null);

  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    reviewer_name: review.reviewer_name,
    images: images.filter((image): image is { id: string; url: string } => Boolean(image)),
    reply,
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
  schoolIds,
  buyerRole,
  resourceType,
  licenseScope,
  featureKeys,
  price,
  licenseBillingCycle,
  grantDurationDays,
}: {
  productId: string;
  buyerId?: string;
  schoolId?: string | null;
  schoolIds?: string[];
  buyerRole?: string | null;
  resourceType: string;
  licenseScope?: 'individual' | 'school' | 'teacher' | 'platform' | null;
  featureKeys?: string[] | null;
  price?: number | null;
  licenseBillingCycle?: string | null;
  grantDurationDays?: number | null;
}): Promise<MarketplaceProductPurchaseAccess> {
  if (resourceType === 'feature_unlock' && licenseScope === 'platform') {
    const { data: licenses } = await supabaseAdmin
      .from('marketplace_platform_licenses')
      .select('expires_at')
      .eq('product_id', productId)
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('expires_at', { ascending: false })
      .limit(1);
    const activeLicense = licenses?.[0];
    if (activeLicense) {
      return {
        canPurchase: false,
        hasPurchased: true,
        accessExpiresAt: activeLicense.expires_at,
        message: 'License นี้เปิดใช้งานสำหรับทุกคนในแพลตฟอร์มแล้ว',
      };
    }
    return {
      canPurchase: Boolean(buyerId && buyerRole === 'master_admin'),
      hasPurchased: false,
      accessExpiresAt: null,
      message: !buyerId
        ? 'กรุณาเข้าสู่ระบบด้วยบัญชี Master Admin เพื่อเปิด License นี้'
        : buyerRole !== 'master_admin'
          ? 'เฉพาะ Master Admin เท่านั้นที่เปิด License สำหรับทั้งแพลตฟอร์มได้'
          : null,
    };
  }

  if (!buyerId) {
    return {
      canPurchase: true,
      hasPurchased: false,
      accessExpiresAt: null,
      message: null,
    };
  }

  if (resourceType === 'feature_unlock') {
    if (licenseScope === 'individual') {
      const isSingleUseTrial =
        Number(price) === 0 && licenseBillingCycle === 'contract' && Number(grantDurationDays) > 0;
      const [{ data: licenses }, hasPurchased] = await Promise.all([
        supabaseAdmin
          .from('marketplace_user_licenses')
          .select('expires_at')
          .eq('buyer_id', buyerId)
          .eq('product_id', productId)
          .eq('status', 'active')
          .order('expires_at', { ascending: false })
          .limit(1),
        isSingleUseTrial || featureKeys?.includes(MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY)
          ? hasPurchasedProduct(productId, buyerId)
          : Promise.resolve(false),
      ]);
      const expiresAt = licenses?.[0]?.expires_at ?? null;
      const isPerpetual = Boolean(licenses?.length && !expiresAt);
      const isActive =
        isPerpetual || Boolean(expiresAt && new Date(expiresAt).getTime() > Date.now());
      const trialAlreadyUsed =
        (isSingleUseTrial || featureKeys?.includes(MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY)) &&
        hasPurchased;
      return {
        canPurchase: !isActive && !trialAlreadyUsed,
        hasPurchased: Boolean(licenses?.length) || hasPurchased,
        accessExpiresAt: expiresAt,
        message: isPerpetual
          ? 'บัญชีนี้ซื้อสิทธิ์ถาวรแล้ว'
          : isActive
            ? 'สิทธิ์ส่วนบุคคลนี้ยังใช้งานอยู่'
            : trialAlreadyUsed
              ? 'บัญชีนี้เคยใช้สิทธิ์ทดลองใช้งานแล้ว'
              : null,
      };
    }

    const targetSchoolIds = schoolIds?.length ? schoolIds : schoolId ? [schoolId] : [];
    if (!targetSchoolIds.length) {
      return {
        canPurchase: false,
        hasPurchased: false,
        accessExpiresAt: null,
        message: 'สินค้านี้ซื้อได้เฉพาะบัญชีผู้ดูแลโรงเรียน',
      };
    }
    const { data: licenses } = await supabaseAdmin
      .from('marketplace_school_licenses')
      .select('school_id,expires_at')
      .in('school_id', targetSchoolIds)
      .eq('product_id', productId)
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    const licensedSchoolIds = new Set((licenses ?? []).map((license) => license.school_id));
    const canPurchase = targetSchoolIds.some((id) => !licensedSchoolIds.has(id));
    const expiresAt = canPurchase
      ? null
      : ((licenses ?? [])
          .map((license) => license.expires_at)
          .sort()
          .at(-1) ?? null);
    return {
      canPurchase,
      hasPurchased: Boolean(licenses?.length),
      accessExpiresAt: expiresAt,
      message: canPurchase ? null : 'ทุกโรงเรียนที่คุณดูแลมีสิทธิ์ Subscription นี้อยู่แล้ว',
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
  const [
    viewsResult,
    likesResult,
    downloadsResult,
    purchasesResult,
    reviewsResult,
    canReview,
    sellerResult,
  ] = await Promise.all([
    supabaseAdmin
      .from('marketplace_product_views')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId),
    supabaseAdmin
      .from('marketplace_product_collections')
      .select('product_id', { count: 'exact', head: true })
      .eq('product_id', productId)
      .eq('collection_type', 'favorite'),
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
      .select(
        'id, buyer_id, rating, comment, reviewer_name, created_at, updated_at, images:marketplace_review_images(id, storage_bucket, storage_path, position), reply:marketplace_review_replies(id, responder_name, comment, created_at, updated_at)'
      )
      .eq('product_id', productId)
      .order('updated_at', { ascending: false }),
    buyerId ? hasPurchasedProduct(productId, buyerId) : Promise.resolve(false),
    buyerId
      ? supabaseAdmin
          .from('marketplace_products')
          .select('seller:marketplace_sellers!inner(owner_id)')
          .eq('id', productId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const reviewRows = (reviewsResult.data ?? []) as unknown as ReviewRow[];
  const reviews = await Promise.all(reviewRows.map(toPublicReview));
  const ratingTotal = reviews.reduce((sum, review) => sum + Number(review.rating), 0);
  const purchases = ((purchasesResult.data ?? []) as unknown as PurchasedItem[]).reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  return {
    views: viewsResult.count ?? 0,
    likes: likesResult.count ?? 0,
    purchases,
    downloads: downloadsResult.count ?? 0,
    reviewCount: reviews.length,
    averageRating: reviews.length ? ratingTotal / reviews.length : 0,
    reviews: reviews.slice(0, 20),
    canReview,
    canReply:
      Boolean(buyerId) &&
      (() => {
        const seller = sellerResult.data?.seller;
        const row = Array.isArray(seller) ? seller[0] : seller;
        return row?.owner_id === buyerId;
      })(),
    myReview: buyerId
      ? (() => {
          const ownIndex = reviewRows.findIndex((review) => review.buyer_id === buyerId);
          return ownIndex >= 0 ? reviews[ownIndex] : null;
        })()
      : null,
  };
}
