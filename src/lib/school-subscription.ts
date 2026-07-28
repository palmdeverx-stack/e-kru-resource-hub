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
  return (
    isSubscriptionUsable(subscription) && (subscription?.enabled_features ?? []).includes(feature)
  );
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
