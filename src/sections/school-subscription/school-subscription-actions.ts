'use client';

import type { SchoolFeatureKey } from 'src/lib/school-subscription-config';

// ----------------------------------------------------------------------

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled';
export type BillingCycle = 'monthly' | 'yearly' | 'custom';

export type SchoolSubscription = {
  id: string;
  school_id: string;
  plan_name: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  price: number;
  currency: string;
  starts_at: string;
  ends_at: string | null;
  max_school_admins: number;
  max_teachers: number;
  max_students: number;
  max_line_notifications: number;
  enabled_features: SchoolFeatureKey[];
  notes: string | null;
  updated_at: string;
};

export type SchoolSubscriptionData = {
  school: {
    id: string;
    name: string;
    code: string;
    logo_url: string | null;
    is_active: boolean;
  };
  subscription: SchoolSubscription;
  usage: {
    schoolAdmins: number;
    teachers: number;
    students: number;
  };
};

export type SchoolSubscriptionAccessData = {
  school: SchoolSubscriptionData['school'];
  subscription: Pick<
    SchoolSubscription,
    | 'id'
    | 'school_id'
    | 'plan_name'
    | 'status'
    | 'starts_at'
    | 'ends_at'
    | 'enabled_features'
    | 'updated_at'
  >;
};

export type UpdateSchoolSubscriptionParams = {
  planName: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  price: number;
  startsAt: string;
  endsAt: string | null;
  maxSchoolAdmins: number;
  maxTeachers: number;
  maxStudents: number;
  maxLineNotifications: number;
  enabledFeatures: SchoolFeatureKey[];
  notes: string;
};

export async function getSchoolSubscription(schoolId: string): Promise<SchoolSubscriptionData> {
  const response = await fetch(`/api/schools/${schoolId}/subscription`, {});
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดแพ็กเกจโรงเรียนได้');
  return json;
}

export async function getSchoolSubscriptionAccess(
  schoolId: string
): Promise<SchoolSubscriptionAccessData> {
  const response = await fetch(`/api/schools/${schoolId}/subscription`, {});
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถตรวจสอบแพ็กเกจโรงเรียนได้');
  return json;
}

export async function updateSchoolSubscription(
  schoolId: string,
  params: UpdateSchoolSubscriptionParams
): Promise<SchoolSubscription> {
  const response = await fetch(`/api/schools/${schoolId}/subscription`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถบันทึกแพ็กเกจโรงเรียนได้');
  return json.subscription;
}
