'use client';

import type { StaffType } from 'src/types/staff-employment';

// ----------------------------------------------------------------------

export type AccessLevel = 'none' | 'view' | 'manage';
export type OverrideAccessLevel = 'inherit' | AccessLevel;

export type AccessPermissionData = {
  staffTypePermissions: {
    staff_type: StaffType;
    permission_key: string;
    access_level: 'view' | 'manage';
  }[];
  staff: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    staff_type: StaffType | null;
    overrides: { permission_key: string; access_level: AccessLevel }[];
  }[];
  staffTypes: {
    code: string;
    name: string;
    name_en: string | null;
    is_active: boolean;
  }[];
};

export async function getAccessPermissions(): Promise<AccessPermissionData> {
  const response = await fetch('/api/access-permissions');
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดสิทธิ์ได้');
  return json;
}

export async function saveStaffTypePermissions(
  staffType: StaffType,
  permissions: { key: string; level: AccessLevel }[]
) {
  const response = await fetch('/api/access-permissions', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: 'staff_type', staffType, permissions }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถบันทึกสิทธิ์ตามประเภทบุคลากรได้');
}

export async function saveUserPermissionOverrides(
  userId: string,
  permissions: { key: string; level: OverrideAccessLevel }[]
) {
  const response = await fetch('/api/access-permissions', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: 'user', userId, permissions }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถบันทึกสิทธิ์รายบุคคลได้');
}
