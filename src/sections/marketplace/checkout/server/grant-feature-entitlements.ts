import 'server-only';

import type { SchoolFeatureKey } from 'src/lib/school-subscription-config';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { grantSchoolFeatureUntil } from 'src/lib/school-subscription';

type OrderItemRow = {
  id: string;
  order_id: string;
  product: {
    id: string;
    resource_type: string;
    grants_feature_key: string | null;
    grants_feature_keys: string[] | null;
    grant_duration_days: number | null;
    license_scope: 'school' | 'teacher' | null;
    license_seat_count: number | null;
  } | null;
  order: { buyer_id: string } | null;
};

/**
 * Creates retry-safe licenses for paid feature products. The unique order-item
 * key prevents duplicate licenses, while school-wide compatibility grants are
 * reconciled on every call so a partially failed payment callback can recover.
 */
export async function grantFeatureEntitlementsForOrders(orderIds: string[]) {
  if (!orderIds.length) return [];

  const { data, error } = await supabaseAdmin
    .from('marketplace_order_items')
    .select(
      'id, order_id, product:marketplace_products(id, resource_type, grants_feature_key, grants_feature_keys, grant_duration_days, license_scope, license_seat_count), order:marketplace_orders(buyer_id)'
    )
    .in('order_id', orderIds);
  if (error) throw error;

  const featureItems = ((data ?? []) as unknown as OrderItemRow[]).filter(
    (item) =>
      item.product?.resource_type === 'feature_unlock' &&
      (item.product.grants_feature_keys?.length || item.product.grants_feature_key) &&
      (item.product.grant_duration_days ?? 0) > 0
  );
  if (!featureItems.length) return [];

  const buyerIds = [
    ...new Set(featureItems.map((item) => item.order?.buyer_id).filter((id): id is string => !!id)),
  ];
  const { data: buyers, error: buyerError } = await supabaseAdmin
    .from('app_users')
    .select('id, school_id')
    .in('id', buyerIds);
  if (buyerError) throw buyerError;
  const schoolByBuyer = new Map<string, string | null>(
    (buyers ?? []).map((row: { id: string; school_id: string | null }) => [row.id, row.school_id])
  );

  const licenses = [];
  for (const item of featureItems) {
    const product = item.product!;
    const buyerId = item.order?.buyer_id;
    const schoolId = buyerId ? schoolByBuyer.get(buyerId) : null;
    if (!schoolId) throw new Error(`ไม่พบโรงเรียนของผู้ซื้อในคำสั่งซื้อ ${item.order_id}`);

    const featureKeys = [
      ...new Set(
        product.grants_feature_keys?.length
          ? product.grants_feature_keys
          : product.grants_feature_key
            ? [product.grants_feature_key]
            : []
      ),
    ] as SchoolFeatureKey[];
    const startsAt = new Date();
    const expiresAt = new Date(
      startsAt.getTime() + Number(product.grant_duration_days) * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: existingLicense, error: licenseError } = await supabaseAdmin
      .from('marketplace_school_licenses')
      .select('*')
      .eq('order_item_id', item.id)
      .maybeSingle();
    if (licenseError) throw licenseError;
    let license = existingLicense;

    if (!license) {
      const inserted = await supabaseAdmin
        .from('marketplace_school_licenses')
        .insert({
          school_id: schoolId,
          product_id: product.id,
          order_id: item.order_id,
          order_item_id: item.id,
          license_scope: product.license_scope ?? 'school',
          feature_keys: featureKeys,
          seat_count: product.license_scope === 'teacher' ? product.license_seat_count ?? 1 : 1,
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt,
        })
        .select('*')
        .single();
      if (inserted.error) throw inserted.error;
      license = inserted.data;
    }

    if (license.license_scope === 'school') {
      await Promise.all(
        featureKeys.map((featureKey) =>
          grantSchoolFeatureUntil(schoolId, featureKey, license.expires_at, {
            orderId: item.order_id,
            productId: product.id,
          })
        )
      );
    }
    licenses.push(license);
  }

  return licenses;
}
