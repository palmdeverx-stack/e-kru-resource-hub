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
    grants_plan_code: string | null;
    grant_duration_days: number | null;
    license_scope: 'individual' | 'school' | 'teacher' | 'platform' | null;
    license_seat_count: number | null;
    license_max_teachers: number | null;
    license_max_students: number | null;
    license_max_school_admins: number | null;
    license_line_quota: number | null;
  } | null;
  order: { buyer_id: string; license_school_id: string | null } | null;
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
      'id, order_id, product:marketplace_products(id, resource_type, grants_feature_key, grants_feature_keys, grants_plan_code, grant_duration_days, license_scope, license_seat_count, license_max_teachers, license_max_students, license_max_school_admins, license_line_quota), order:marketplace_orders(buyer_id,license_school_id)'
    )
    .in('order_id', orderIds);
  if (error) throw error;

  const featureItems = ((data ?? []) as unknown as OrderItemRow[]).filter((item) => {
    const featureKeys = item.product?.grants_feature_keys?.length
      ? item.product.grants_feature_keys
      : item.product?.grants_feature_key
        ? [item.product.grants_feature_key]
        : [];
    return (
      item.product?.resource_type === 'feature_unlock' &&
      featureKeys.length > 0 &&
      (item.product.grant_duration_days == null || item.product.grant_duration_days > 0)
    );
  });
  if (!featureItems.length) return [];

  const licenses = [];
  for (const item of featureItems) {
    const product = item.product!;
    const featureKeys = [
      ...new Set(
        product.grants_feature_keys?.length
          ? product.grants_feature_keys
          : product.grants_feature_key
            ? [product.grants_feature_key]
            : []
      ),
    ] as string[];
    const startsAt = new Date();
    const isPerpetual = product.grant_duration_days == null;

    if (product.license_scope === 'platform') {
      const { data: previousLicense } = await supabaseAdmin
        .from('marketplace_platform_licenses')
        .select('id,expires_at')
        .eq('product_id', product.id)
        .eq('status', 'active')
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const expiryBase =
        previousLicense?.expires_at && new Date(previousLicense.expires_at) > startsAt
          ? new Date(previousLicense.expires_at)
          : startsAt;
      const expiresAt = isPerpetual
        ? null
        : new Date(
            expiryBase.getTime() + Number(product.grant_duration_days) * 24 * 60 * 60 * 1000
          ).toISOString();
      const { data: existingLicense, error: existingError } = await supabaseAdmin
        .from('marketplace_platform_licenses')
        .select('*')
        .eq('order_item_id', item.id)
        .maybeSingle();
      if (existingError) throw existingError;
      let license = existingLicense;

      if (!license) {
        const inserted = await supabaseAdmin
          .from('marketplace_platform_licenses')
          .insert({
            product_id: product.id,
            order_id: item.order_id,
            order_item_id: item.id,
            feature_keys: featureKeys,
            grants_plan_code: product.grants_plan_code,
            duration_days: product.grant_duration_days,
            renewed_from_license_id: previousLicense?.id ?? null,
            starts_at: startsAt.toISOString(),
            expires_at: expiresAt,
          })
          .select('*')
          .single();
        if (inserted.error) throw inserted.error;
        license = inserted.data;
      }
      licenses.push(license);
      continue;
    }

    if (product.license_scope === 'individual') {
      const buyerId = item.order?.buyer_id;
      if (!buyerId) throw new Error(`ไม่พบผู้ซื้อในคำสั่งซื้อ ${item.order_id}`);
      const { data: previousLicense } = await supabaseAdmin
        .from('marketplace_user_licenses')
        .select('id,expires_at')
        .eq('buyer_id', buyerId)
        .eq('product_id', product.id)
        .eq('status', 'active')
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const expiryBase =
        previousLicense?.expires_at && new Date(previousLicense.expires_at) > startsAt
          ? new Date(previousLicense.expires_at)
          : startsAt;
      const expiresAt = isPerpetual
        ? null
        : new Date(
            expiryBase.getTime() + Number(product.grant_duration_days) * 24 * 60 * 60 * 1000
          ).toISOString();
      const { data: existingLicense, error: existingError } = await supabaseAdmin
        .from('marketplace_user_licenses')
        .select('*')
        .eq('order_item_id', item.id)
        .maybeSingle();
      if (existingError) throw existingError;
      let license = existingLicense;

      if (!license) {
        const inserted = await supabaseAdmin
          .from('marketplace_user_licenses')
          .insert({
            buyer_id: buyerId,
            product_id: product.id,
            order_id: item.order_id,
            order_item_id: item.id,
            feature_keys: featureKeys,
            grants_plan_code: product.grants_plan_code,
            duration_days: isPerpetual ? null : product.grant_duration_days,
            renewed_from_license_id: previousLicense?.id ?? null,
            starts_at: startsAt.toISOString(),
            expires_at: expiresAt,
          })
          .select('*')
          .single();
        if (inserted.error) throw inserted.error;
        license = inserted.data;
        await supabaseAdmin.from('marketplace_user_license_events').insert({
          license_id: license.id,
          event_type: previousLicense ? 'renewed' : 'created',
          order_id: item.order_id,
        });
      }
      licenses.push(license);
      continue;
    }

    const schoolId = item.order?.license_school_id;
    // Marketplace-only buyers can pay first and create their school from the
    // secure onboarding link. Fulfillment is retried after the school is bound.
    if (!schoolId) continue;

    const { data: previousLicense } = await supabaseAdmin
      .from('marketplace_school_licenses')
      .select('id,expires_at')
      .eq('school_id', schoolId)
      .eq('product_id', product.id)
      .eq('status', 'active')
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const expiryBase =
      previousLicense?.expires_at && new Date(previousLicense.expires_at) > startsAt
        ? new Date(previousLicense.expires_at)
        : startsAt;
    const expiresAt = isPerpetual
      ? null
      : new Date(
          expiryBase.getTime() + Number(product.grant_duration_days) * 24 * 60 * 60 * 1000
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
          seat_count: product.license_scope === 'teacher' ? (product.license_seat_count ?? 1) : 1,
          grants_plan_code: product.grants_plan_code,
          max_teachers: product.license_max_teachers,
          max_students: product.license_max_students,
          max_school_admins: product.license_max_school_admins,
          line_quota: product.license_line_quota,
          duration_days: product.grant_duration_days,
          renewed_from_license_id: previousLicense?.id ?? null,
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt,
        })
        .select('*')
        .single();
      if (inserted.error) throw inserted.error;
      license = inserted.data;
      await supabaseAdmin.from('marketplace_school_license_events').insert({
        license_id: license.id,
        event_type: previousLicense ? 'renewed' : 'created',
        order_id: item.order_id,
      });
    }

    if (license.license_scope === 'school') {
      await Promise.all(
        featureKeys.map((featureKey) =>
          grantSchoolFeatureUntil(schoolId, featureKey as SchoolFeatureKey, license.expires_at, {
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
