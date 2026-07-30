import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

import { syncSellerLineFeatureProducts } from './seller-line-product';
import {
  MARKETPLACE_SELLER_LINE_FEATURE_KEY,
  MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY,
} from '../line-feature';

export type SellerLineFeatureAccess = {
  allowed: boolean;
  entitled: boolean;
  purchaseProductId: string | null;
  purchasePrice: number | null;
  purchaseOptions: Array<{
    key: string;
    productId: string;
    price: number;
    description: string;
    quota: number | null;
  }>;
};

type ProductOptionRow = {
  id: string;
  price: number | string;
  grants_feature_keys?: string[] | null;
  short_description?: string | null;
  license_line_quota?: number | null;
  key?: string;
  description?: string;
  quota?: number | null;
};

export async function getSellerLineFeatureAccess(
  userId: string,
  role?: string
): Promise<SellerLineFeatureAccess> {
  if (role === 'master_admin' || role === 'super_admin') {
    return {
      allowed: true,
      entitled: true,
      purchaseProductId: null,
      purchasePrice: null,
      purchaseOptions: [],
    };
  }

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('marketplace_line_settings')
    .select(
      'allow_seller_notifications, seller_notification_price, seller_byoa_description, seller_managed_price, seller_managed_description, seller_managed_quota'
    )
    .eq('id', 'default')
    .maybeSingle();
  if (settingsError) throw settingsError;

  const allowed = settings?.allow_seller_notifications === true;
  if (!allowed) {
    return {
      allowed: false,
      entitled: false,
      purchaseProductId: null,
      purchasePrice: null,
      purchaseOptions: [],
    };
  }

  const now = new Date().toISOString();
  const keys = [MARKETPLACE_SELLER_LINE_FEATURE_KEY, MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY];
  const [{ data: license, error: licenseError }, { data: foundProducts, error: productError }] =
    await Promise.all([
      supabaseAdmin
        .from('marketplace_user_licenses')
        .select('id')
        .eq('buyer_id', userId)
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .overlaps('feature_keys', keys)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('marketplace_products')
        .select('id, price, grants_feature_keys, short_description, license_line_quota')
        .eq('status', 'published')
        .eq('resource_type', 'feature_unlock')
        .eq('license_scope', 'individual')
        .overlaps('grants_feature_keys', keys)
        .order('created_at', { ascending: false })
        .limit(2),
    ]);
  if (licenseError || productError) throw licenseError ?? productError;

  let products: ProductOptionRow[] = foundProducts ?? [];
  if (products.length < 2) {
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
      });
    }
  }

  const options = products.map((product) => {
    const productKey =
      product.key ??
      (product.grants_feature_keys?.includes(MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY)
        ? MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY
        : MARKETPLACE_SELLER_LINE_FEATURE_KEY);
    return {
      key: productKey,
      productId: product.id,
      price: Number(product.price),
      description: product.description ?? product.short_description ?? '',
      quota: product.quota ?? product.license_line_quota ?? null,
    };
  });
  return {
    allowed: true,
    entitled: Boolean(license),
    purchaseProductId: options[0]?.productId ?? null,
    purchasePrice: options[0]?.price ?? null,
    purchaseOptions: options,
  };
}
