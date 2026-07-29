import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

async function reconcileFeature(schoolId: string, featureKey: string) {
  const { data: licenses } = await supabaseAdmin
    .from('marketplace_school_licenses')
    .select('expires_at,order_id,product_id')
    .eq('school_id', schoolId)
    .eq('license_scope', 'school')
    .eq('status', 'active')
    .contains('feature_keys', [featureKey])
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1);
  const effective = licenses?.[0];
  await supabaseAdmin.from('school_feature_purchases').upsert(
    {
      school_id: schoolId,
      feature_key: featureKey,
      expires_at: effective?.expires_at ?? new Date().toISOString(),
      source_order_id: effective?.order_id ?? null,
      source_product_id: effective?.product_id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'school_id,feature_key' }
  );
}

export async function revokeSchoolLicense(
  licenseId: string,
  status: 'refunded' | 'revoked',
  reason: string,
  paymentSessionId?: string
) {
  const { data: license, error } = await supabaseAdmin
    .from('marketplace_school_licenses')
    .select('*')
    .eq('id', licenseId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (!license) return null;

  const now = new Date().toISOString();
  await supabaseAdmin
    .from('marketplace_school_licenses')
    .update({ status, revoked_at: now, revoke_reason: reason, updated_at: now })
    .eq('id', license.id)
    .eq('status', 'active');
  await supabaseAdmin
    .from('marketplace_teacher_license_assignments')
    .update({ revoked_at: now, updated_at: now })
    .eq('license_id', license.id)
    .is('revoked_at', null);
  await supabaseAdmin.from('marketplace_school_license_events').insert({
    license_id: license.id,
    event_type: status,
    order_id: license.order_id,
    payment_session_id: paymentSessionId ?? null,
    reason,
  });
  await Promise.all(
    (license.feature_keys as string[]).map((featureKey) =>
      reconcileFeature(license.school_id, featureKey)
    )
  );
  return license;
}

export async function revokeUserLicense(
  licenseId: string,
  status: 'refunded' | 'revoked',
  reason: string,
  paymentSessionId?: string
) {
  const { data: license, error } = await supabaseAdmin
    .from('marketplace_user_licenses')
    .select('*')
    .eq('id', licenseId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (!license) return null;

  const now = new Date().toISOString();
  await supabaseAdmin
    .from('marketplace_user_licenses')
    .update({ status, revoked_at: now, revoke_reason: reason, updated_at: now })
    .eq('id', license.id)
    .eq('status', 'active');
  await supabaseAdmin.from('marketplace_user_license_events').insert({
    license_id: license.id,
    event_type: status,
    order_id: license.order_id,
    payment_session_id: paymentSessionId ?? null,
    reason,
  });
  return license;
}

export async function revokeLicensesForPaymentSession(
  paymentSessionId: string,
  status: 'refunded' | 'revoked',
  reason: string
) {
  const { data: orders, error: orderError } = await supabaseAdmin
    .from('marketplace_orders')
    .select('id')
    .eq('payment_session_id', paymentSessionId);
  if (orderError) throw orderError;
  const orderIds = (orders ?? []).map((order) => order.id);
  if (!orderIds.length) return [];

  const { data: licenses, error: licenseError } = await supabaseAdmin
    .from('marketplace_school_licenses')
    .select('*')
    .in('order_id', orderIds)
    .eq('status', 'active');
  if (licenseError) throw licenseError;
  for (const license of licenses ?? []) {
    await revokeSchoolLicense(license.id, status, reason, paymentSessionId);
  }
  const { data: userLicenses, error: userLicenseError } = await supabaseAdmin
    .from('marketplace_user_licenses')
    .select('*')
    .in('order_id', orderIds)
    .eq('status', 'active');
  if (userLicenseError) throw userLicenseError;
  for (const license of userLicenses ?? []) {
    await revokeUserLicense(license.id, status, reason, paymentSessionId);
  }
  return [...(licenses ?? []), ...(userLicenses ?? [])];
}
