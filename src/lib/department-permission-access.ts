import 'server-only';

import type { DepartmentPermissionKey } from './department-permissions-config';

import { supabaseAdmin } from './supabase-admin';
import {
  isDepartmentPermissionKey,
  isDepartmentDelegablePermission,
  isManageableDepartmentPermission,
} from './department-permissions-config';

// ----------------------------------------------------------------------

async function loadMembership(teacherId: string, schoolId: string) {
  const { data: membership } = await supabaseAdmin
    .from('department_members')
    .select('id, department_id, department:departments!inner(school_id)')
    .eq('teacher_id', teacherId)
    .maybeSingle();

  if (!membership) return null;
  if ((membership.department as unknown as { school_id: string }).school_id !== schoolId) {
    return null;
  }
  return membership;
}

type AccessLevel = 'none' | 'view' | 'manage';

async function loadStaffAccess(teacherId: string, schoolId: string) {
  const { data: teacher } = await supabaseAdmin
    .from('app_users')
    .select('staff_type')
    .eq('id', teacherId)
    .eq('school_id', schoolId)
    .eq('role', 'teacher')
    .maybeSingle();

  const [{ data: typePermissions }, { data: overrides }] = await Promise.all([
    teacher?.staff_type
      ? supabaseAdmin
          .from('staff_type_permissions')
          .select('permission_key, access_level')
          .eq('school_id', schoolId)
          .eq('staff_type', teacher.staff_type)
      : Promise.resolve({ data: [] }),
    supabaseAdmin
      .from('staff_permission_overrides')
      .select('permission_key, access_level')
      .eq('school_id', schoolId)
      .eq('user_id', teacherId),
  ]);

  return {
    typePermissions: typePermissions ?? [],
    overrides: (overrides ?? []) as { permission_key: string; access_level: AccessLevel }[],
  };
}

function applyStaffAccess(
  base: Set<DepartmentPermissionKey>,
  typePermissions: { permission_key: string; access_level: string }[],
  overrides: { permission_key: string; access_level: AccessLevel }[],
  mode: 'view' | 'manage'
) {
  if (mode === 'manage') {
    for (const permission of base) {
      if (!isManageableDepartmentPermission(permission)) base.delete(permission);
    }
  }

  for (const permission of typePermissions) {
    if (
      isDepartmentPermissionKey(permission.permission_key) &&
      (mode === 'view' || isManageableDepartmentPermission(permission.permission_key)) &&
      (mode === 'view' || permission.access_level === 'manage')
    ) {
      base.add(permission.permission_key);
    }
  }

  for (const override of overrides) {
    if (!isDepartmentPermissionKey(override.permission_key)) continue;
    if (
      override.access_level === 'none' ||
      (mode === 'manage' && override.access_level === 'view')
    ) {
      base.delete(override.permission_key);
    } else {
      base.add(override.permission_key);
    }
  }

  return [...base];
}

/**
 * Permission keys `teacherId`'s department has switched on — any member of
 * that department can VIEW pages gated by these, regardless of whether they
 * personally were delegated the permission (that's what decides edit rights,
 * see `getEffectiveDepartmentPermissions`).
 */
export async function getDepartmentGrantedPermissions(
  teacherId: string,
  schoolId: string
): Promise<DepartmentPermissionKey[]> {
  const [membership, staffAccess] = await Promise.all([
    loadMembership(teacherId, schoolId),
    loadStaffAccess(teacherId, schoolId),
  ]);

  const { data: departmentGrants } = membership
    ? await supabaseAdmin
        .from('department_permissions')
        .select('permission_key')
        .eq('department_id', membership.department_id)
    : { data: [] };

  const base = new Set<DepartmentPermissionKey>(
    (departmentGrants ?? [])
      .map((row) => row.permission_key)
      .filter(isDepartmentPermissionKey)
      .filter(isDepartmentDelegablePermission)
  );
  const resolved = applyStaffAccess(
    base,
    staffAccess.typePermissions,
    staffAccess.overrides,
    'view'
  );
  // Academic staff who may inspect grades must also be able to open the
  // approval queue. Only an explicit manage-level grades.approve grant can
  // perform the executive approval action.
  if (resolved.includes('grades.review') && !resolved.includes('grades.approve')) {
    resolved.push('grades.approve');
  }
  return resolved;
}

/**
 * Permission keys `teacherId` personally holds — their department must have
 * the permission switched on, AND they personally must be granted it within
 * that department. This is the stricter, edit/manage-level check; use
 * `getDepartmentGrantedPermissions` for read/view access shared by the whole
 * department.
 */
export async function getEffectiveDepartmentPermissions(
  teacherId: string,
  schoolId: string
): Promise<DepartmentPermissionKey[]> {
  const [membership, staffAccess] = await Promise.all([
    loadMembership(teacherId, schoolId),
    loadStaffAccess(teacherId, schoolId),
  ]);

  const [{ data: departmentGrants }, { data: memberGrants }] = membership
    ? await Promise.all([
        supabaseAdmin
          .from('department_permissions')
          .select('permission_key')
          .eq('department_id', membership.department_id),
        supabaseAdmin
          .from('department_member_permissions')
          .select('permission_key')
          .eq('member_id', membership.id),
      ])
    : [{ data: [] }, { data: [] }];

  const departmentKeys = new Set((departmentGrants ?? []).map((row) => row.permission_key));

  const base = new Set<DepartmentPermissionKey>(
    (memberGrants ?? [])
      .map((row) => row.permission_key)
      .filter(
        (key): key is DepartmentPermissionKey =>
          departmentKeys.has(key) &&
          isDepartmentPermissionKey(key) &&
          isDepartmentDelegablePermission(key)
      )
  );
  return applyStaffAccess(
    base,
    staffAccess.typePermissions,
    staffAccess.overrides,
    'manage'
  );
}

export async function hasDepartmentPermission(
  teacherId: string,
  schoolId: string,
  permissionKey: DepartmentPermissionKey
): Promise<boolean> {
  const permissions = await getEffectiveDepartmentPermissions(teacherId, schoolId);
  return permissions.includes(permissionKey);
}

type PermissionCaller = { role: string; sub: string; schoolId: string | null };

/**
 * True if `caller` may VIEW a resource gated by `permissionKey` — the school
 * admin, or any teacher whose department has the permission switched on
 * (doesn't require the teacher to be personally delegated it).
 */
export async function canViewViaPermission(
  caller: PermissionCaller,
  permissionKey: DepartmentPermissionKey
): Promise<boolean> {
  if (caller.role === 'school_admin') return true;
  if (caller.role !== 'teacher' || !caller.schoolId) return false;
  const granted = await getDepartmentGrantedPermissions(caller.sub, caller.schoolId);
  return granted.includes(permissionKey);
}

/**
 * True if `caller` may act as an admin (create/edit/delete) on a resource
 * gated by `permissionKey` — either they're the school admin, or a teacher
 * personally delegated that permission.
 */
export async function canManageViaPermission(
  caller: PermissionCaller,
  permissionKey: DepartmentPermissionKey
): Promise<boolean> {
  if (caller.role === 'school_admin') return true;
  if (caller.role !== 'teacher' || !caller.schoolId) return false;
  return hasDepartmentPermission(caller.sub, caller.schoolId, permissionKey);
}
