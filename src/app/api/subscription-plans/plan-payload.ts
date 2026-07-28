import { ALL_SCHOOL_FEATURE_KEYS } from 'src/lib/school-subscription-config';

// ----------------------------------------------------------------------

export const BILLING_CYCLES = ['monthly', 'yearly', 'custom'] as const;
const FEATURE_KEYS = new Set<string>(ALL_SCHOOL_FEATURE_KEYS);

export type PlanPayload = {
  code: string;
  name: string;
  description: string | null;
  billing_cycle: (typeof BILLING_CYCLES)[number];
  price: number;
  currency: string;
  max_school_admins: number;
  max_teachers: number;
  max_students: number;
  max_line_notifications: number;
  enabled_features: string[];
  is_active: boolean;
  sort_order: number;
};

export function parsePlanPayload(body: unknown): PlanPayload | null {
  if (!body || typeof body !== 'object') return null;

  const value = body as Record<string, unknown>;
  const code = typeof value.code === 'string' ? value.code.trim().toUpperCase() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const description =
    typeof value.description === 'string' ? value.description.trim().slice(0, 500) : '';
  const billingCycle = value.billingCycle;
  const price = Number(value.price);
  const maxSchoolAdmins = Number(value.maxSchoolAdmins);
  const maxTeachers = Number(value.maxTeachers);
  const maxStudents = Number(value.maxStudents);
  const maxLineNotifications = Number(value.maxLineNotifications);
  const enabledFeatures = value.enabledFeatures;
  const isActive = value.isActive;
  const sortOrder = Number(value.sortOrder);

  if (
    !code ||
    code.length > 50 ||
    !/^[A-Z0-9_-]+$/.test(code) ||
    !name ||
    name.length > 100 ||
    !BILLING_CYCLES.includes(billingCycle as (typeof BILLING_CYCLES)[number]) ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(maxSchoolAdmins) ||
    maxSchoolAdmins < 0 ||
    !Number.isInteger(maxTeachers) ||
    maxTeachers < 0 ||
    !Number.isInteger(maxStudents) ||
    maxStudents < 0 ||
    !Number.isInteger(maxLineNotifications) ||
    maxLineNotifications < 0 ||
    !Array.isArray(enabledFeatures) ||
    enabledFeatures.length === 0 ||
    enabledFeatures.some((key) => typeof key !== 'string' || !FEATURE_KEYS.has(key)) ||
    typeof isActive !== 'boolean' ||
    !Number.isInteger(sortOrder)
  ) {
    return null;
  }

  return {
    code,
    name,
    description: description || null,
    billing_cycle: billingCycle as (typeof BILLING_CYCLES)[number],
    price,
    currency: 'THB',
    max_school_admins: maxSchoolAdmins,
    max_teachers: maxTeachers,
    max_students: maxStudents,
    max_line_notifications: maxLineNotifications,
    enabled_features: Array.from(new Set(enabledFeatures)),
    is_active: isActive,
    sort_order: sortOrder,
  };
}
