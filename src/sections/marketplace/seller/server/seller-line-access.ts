import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

import { syncSellerLineFeatureProducts } from './seller-line-product';
import { hasPurchasedProduct } from '../../catalog/server/product-engagement';
import {
  MARKETPLACE_SELLER_LINE_FEATURE_KEY,
  MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY,
  MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY,
} from '../line-feature';

export type SellerLineFeatureAccess = {
  allowed: boolean;
  entitled: boolean;
  mode: 'byoa' | 'managed' | 'system' | null;
  purchaseProductId: string | null;
  purchasePrice: number | null;
  usage: {
    planLabel: string;
    quotaTotal: number | null;
    quotaUsed: number;
    startsAt: string;
    expiresAt: string | null;
    durationDays: number | null;
  } | null;
  purchaseOptions: Array<{
    key: string;
    productId: string;
    price: number;
    description: string;
    quota: number | null;
    durationDays: number | null;
  }>;
};

type ProductOptionRow = {
  id: string;
  price: number | string;
  grants_feature_keys?: string[] | null;
  short_description?: string | null;
  license_line_quota?: number | null;
  grant_duration_days?: number | null;
  key?: string;
  description?: string;
  quota?: number | null;
  durationDays?: number | null;
};

export async function getSellerLineFeatureAccess(
  userId: string,
  role?: string
): Promise<SellerLineFeatureAccess> {
  if (role === 'master_admin' || role === 'marketplace_admin') {
    return {
      allowed: true,
      entitled: true,
      mode: 'system',
      purchaseProductId: null,
      purchasePrice: null,
      usage: null,
      purchaseOptions: [],
    };
  }

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('marketplace_line_settings')
    .select(
      'allow_seller_notifications, seller_notification_price, seller_byoa_description, seller_managed_price, seller_managed_description, seller_managed_quota, seller_trial_description, seller_trial_days, seller_trial_quota'
    )
    .eq('id', 'default')
    .maybeSingle();
  if (settingsError) throw settingsError;

  const allowed = settings?.allow_seller_notifications === true;
  if (!allowed) {
    return {
      allowed: false,
      entitled: false,
      mode: null,
      purchaseProductId: null,
      purchasePrice: null,
      usage: null,
      purchaseOptions: [],
    };
  }

  const now = new Date().toISOString();
  const keys = [
    MARKETPLACE_SELLER_LINE_FEATURE_KEY,
    MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY,
    MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY,
  ];
  const [{ data: license, error: licenseError }, { data: foundProducts, error: productError }] =
    await Promise.all([
      supabaseAdmin
        .from('marketplace_user_licenses')
        .select(
          'id,feature_keys,order_item_id,starts_at,expires_at,duration_days,created_at,product:marketplace_products(title,license_line_quota)'
        )
        .eq('buyer_id', userId)
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .overlaps('feature_keys', keys)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('marketplace_products')
        .select(
          'id, price, grants_feature_keys, short_description, license_line_quota, grant_duration_days'
        )
        .eq('status', 'published')
        .eq('resource_type', 'feature_unlock')
        .eq('license_scope', 'individual')
        .overlaps('grants_feature_keys', keys)
        .order('created_at', { ascending: false })
        .limit(3),
    ]);
  if (licenseError || productError) {
    throw licenseError ?? productError;
  }

  let quotaUsed = 0;
  if (license?.order_item_id) {
    const { count, error: usageError } = await supabaseAdmin
      .from('marketplace_entitlement_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', userId)
      .eq('order_item_id', license.order_item_id)
      .eq('event_type', 'seller_line_notification_sent');
    if (usageError) throw usageError;
    quotaUsed = count ?? 0;
  }

  let products: ProductOptionRow[] = foundProducts ?? [];
  const trialProduct = products.find((product) =>
    product.grants_feature_keys?.includes(MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY)
  );
  const expectedTrialQuota = Number(settings?.seller_trial_quota ?? 10);
  if (products.length < 3 || Number(trialProduct?.license_line_quota ?? 0) !== expectedTrialQuota) {
    const { data: admin, error: adminError } = await supabaseAdmin
      .from('app_users')
      .select('id')
      .eq('role', 'master_admin')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (adminError) throw adminError;
    if (admin) {
      products = await syncSellerLineFeatureProducts({
        adminUserId: admin.id,
        enabled: true,
        byoa: {
          price: Number(settings?.seller_notification_price ?? 99),
          description: settings?.seller_byoa_description ?? 'ใช้ LINE OA ของตัวเอง',
        },
        managed: {
          price: Number(settings?.seller_managed_price ?? 99),
          description: settings?.seller_managed_description ?? 'ใช้ LINE OA ของระบบ E-KRU',
          quota: Number(settings?.seller_managed_quota ?? 100),
        },
        trial: {
          description:
            settings?.seller_trial_description ??
            'ทดลองใช้ LINE แจ้งเตือนผ่าน OA ของระบบ E-KRU ฟรี 7 วัน',
          durationDays: Number(settings?.seller_trial_days ?? 7),
          quota: expectedTrialQuota,
        },
      });
    }
  }

  let options = products
    .map((product) => {
      const productKey =
        product.key ??
        (product.grants_feature_keys?.includes(MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY)
          ? MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY
          : product.grants_feature_keys?.includes(MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY)
            ? MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY
            : MARKETPLACE_SELLER_LINE_FEATURE_KEY);
      return {
        key: productKey,
        productId: product.id,
        price: Number(product.price),
        description: product.description ?? product.short_description ?? '',
        quota: product.quota ?? product.license_line_quota ?? null,
        durationDays: product.durationDays ?? product.grant_duration_days ?? null,
      };
    })
    .sort((a, b) => {
      const order = [
        MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY,
        MARKETPLACE_SELLER_LINE_FEATURE_KEY,
        MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY,
      ];
      return order.indexOf(a.key) - order.indexOf(b.key);
    });
  const trialOption = options.find(
    (option) => option.key === MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY
  );
  if (trialOption && (await hasPurchasedProduct(trialOption.productId, userId))) {
    options = options.filter((option) => option.key !== MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY);
  }
  const licenseProduct = Array.isArray(license?.product) ? license.product[0] : license?.product;
  const isTrial = license?.feature_keys?.includes(MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY);
  const isManaged =
    isTrial || license?.feature_keys?.includes(MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY);
  return {
    allowed: true,
    entitled: Boolean(license),
    mode: license
      ? license.feature_keys?.some((key: string) =>
          [
            MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY,
            MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY,
          ].includes(key)
        )
        ? 'managed'
        : 'byoa'
      : null,
    purchaseProductId: options[0]?.productId ?? null,
    purchasePrice: options[0]?.price ?? null,
    usage: license
      ? {
          planLabel: isTrial
            ? 'ทดลองใช้งาน'
            : isManaged
              ? 'LINE ของระบบ E-KRU'
              : 'LINE OA ของตัวเอง',
          quotaTotal: isManaged ? Number(licenseProduct?.license_line_quota ?? 0) || null : null,
          quotaUsed,
          startsAt: license.starts_at,
          expiresAt: license.expires_at,
          durationDays: license.duration_days,
        }
      : null,
    purchaseOptions: options,
  };
}
