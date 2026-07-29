import 'server-only';

import type { SchoolFeatureKey } from './school-subscription-config';

import { supabaseAdmin } from './supabase-admin';

// ----------------------------------------------------------------------

export async function loadSchoolSubscription(schoolId: string) {
  const { data } = await supabaseAdmin
    .from('school_subscriptions')
    .select(
      'id, school_id, plan_name, status, billing_cycle, price, currency, starts_at, ends_at, max_school_admins, max_teachers, max_students, enabled_features, notes, updated_at'
    )
    .eq('school_id', schoolId)
    .maybeSingle();
  return data;
}

export function isSubscriptionUsable(
  subscription: Awaited<ReturnType<typeof loadSchoolSubscription>>
) {
  if (!subscription || !['trialing', 'active'].includes(subscription.status)) return false;
  if (!subscription.ends_at) return true;
  return subscription.ends_at >= new Date().toISOString().slice(0, 10);
}

export async function schoolHasFeature(schoolId: string, feature: SchoolFeatureKey) {
  const subscription = await loadSchoolSubscription(schoolId);
  if (isSubscriptionUsable(subscription) && (subscription?.enabled_features ?? []).includes(feature)) {
    return true;
  }

  const { data: licenses } = await supabaseAdmin
    .from('marketplace_school_licenses')
    .select('id')
    .eq('school_id', schoolId)
    .eq('license_scope', 'school')
    .eq('status', 'active')
    .contains('feature_keys', [feature])
    .gt('expires_at', new Date().toISOString())
    .limit(1);
  if (licenses?.length) return true;

  const { data } = await supabaseAdmin
    .from('school_feature_purchases')
    .select('id')
    .eq('school_id', schoolId)
    .eq('feature_key', feature)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return !!data;
}

export async function userHasFeature(
  userId: string,
  schoolId: string,
  feature: SchoolFeatureKey
) {
  if (await schoolHasFeature(schoolId, feature)) return true;

  const { data: assignments, error } = await supabaseAdmin
    .from('marketplace_teacher_license_assignments')
    .select('license_id')
    .eq('teacher_id', userId)
    .is('revoked_at', null);
  if (error || !assignments?.length) return false;

  const { data: licenses } = await supabaseAdmin
    .from('marketplace_school_licenses')
    .select('id')
    .in(
      'id',
      assignments.map((assignment) => assignment.license_id)
    )
    .eq('school_id', schoolId)
    .eq('license_scope', 'teacher')
    .eq('status', 'active')
    .contains('feature_keys', [feature])
    .gt('expires_at', new Date().toISOString())
    .limit(1);
  return Boolean(licenses?.length);
}

/**
 * Grants (or renews) a school's access to a single feature key, e.g. after a
 * marketplace purchase. Additive to (and independent of) the whole-plan
 * `school_subscriptions.enabled_features`/`ends_at` — each feature key here
 * has its own expiry. Renewing extends from the later of the current expiry
 * or now, so renewing early never wastes remaining days.
 */
export async function grantSchoolFeature(
  schoolId: string,
  featureKey: SchoolFeatureKey,
  durationDays: number,
  meta: { orderId?: string; productId?: string } = {}
) {
  const { data: existing } = await supabaseAdmin
    .from('school_feature_purchases')
    .select('expires_at')
    .eq('school_id', schoolId)
    .eq('feature_key', featureKey)
    .maybeSingle();

  const base =
    existing?.expires_at && new Date(existing.expires_at) > new Date()
      ? new Date(existing.expires_at)
      : new Date();
  const expiresAt = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  await grantSchoolFeatureUntil(schoolId, featureKey, expiresAt, meta);
  return expiresAt;
}

export async function grantSchoolFeatureUntil(
  schoolId: string,
  featureKey: SchoolFeatureKey,
  requestedExpiresAt: string,
  meta: { orderId?: string; productId?: string } = {}
) {
  const { data: existing } = await supabaseAdmin
    .from('school_feature_purchases')
    .select('expires_at')
    .eq('school_id', schoolId)
    .eq('feature_key', featureKey)
    .maybeSingle();
  const expiresAt =
    existing?.expires_at && new Date(existing.expires_at) > new Date(requestedExpiresAt)
      ? existing.expires_at
      : requestedExpiresAt;
  const { error } = await supabaseAdmin.from('school_feature_purchases').upsert(
    {
      school_id: schoolId,
      feature_key: featureKey,
      expires_at: expiresAt,
      source_order_id: meta.orderId ?? null,
      source_product_id: meta.productId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'school_id,feature_key' }
  );
  if (error) throw error;
  return expiresAt;
}

export async function checkSchoolSeatLimit(
  schoolId: string,
  role: 'school_admin' | 'teacher' | 'student'
) {
  const subscription = await loadSchoolSubscription(schoolId);
  if (!isSubscriptionUsable(subscription)) {
    return { allowed: false, message: 'แพ็กเกจโรงเรียนหมดอายุหรือถูกระงับ' };
  }

  const limit =
    role === 'school_admin'
      ? subscription!.max_school_admins
      : role === 'teacher'
        ? subscription!.max_teachers
        : subscription!.max_students;
  if (limit === 0) return { allowed: true, limit, count: 0 };

  const { count } = await supabaseAdmin
    .from('app_users')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('role', role)
    .eq('is_active', true);
  const activeCount = count ?? 0;
  return {
    allowed: activeCount < limit,
    limit,
    count: activeCount,
    message:
      activeCount >= limit
        ? `จำนวนบัญชี${role === 'teacher' ? 'ครู' : role === 'student' ? 'นักเรียน' : 'ผู้ดูแลโรงเรียน'}เต็มตามแพ็กเกจแล้ว (${activeCount}/${limit})`
        : undefined,
  };
}
