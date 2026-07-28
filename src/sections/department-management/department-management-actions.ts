'use client';

import type { DepartmentPermissionKey } from 'src/lib/department-permissions-config';

// ----------------------------------------------------------------------

export type DepartmentTeacher = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url?: string | null;
};

export type DepartmentMember = {
  id: string;
  role_in_department: 'head' | 'member';
  permissions: DepartmentPermissionKey[];
  teacher: DepartmentTeacher;
};

export type Department = {
  id: string;
  name: string;
  description: string | null;
  permissions: DepartmentPermissionKey[];
  created_at: string;
  members: DepartmentMember[];
};

export async function listDepartments(): Promise<Department[]> {
  const response = await fetch('/api/departments', {});
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to load departments');
  return json.departments;
}

export type SaveDepartmentParams = {
  name: string;
  description?: string;
  permissions?: string[];
};

export async function createDepartment(params: SaveDepartmentParams): Promise<Department> {
  const response = await fetch('/api/departments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to create department');
  return json.department;
}

export async function updateDepartment(
  id: string,
  params: SaveDepartmentParams
): Promise<Department> {
  const response = await fetch(`/api/departments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to update department');
  return json.department;
}

export async function deleteDepartment(id: string): Promise<void> {
  const response = await fetch(`/api/departments/${id}`, {
    method: 'DELETE',
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to delete department');
}

export async function getDepartmentMembers(departmentId: string): Promise<{
  department: { id: string; name: string; permissions: DepartmentPermissionKey[] };
  members: DepartmentMember[];
  eligibleTeachers: DepartmentTeacher[];
}> {
  const response = await fetch(`/api/departments/${departmentId}/members`, {});
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to load members');
  return json;
}

export async function addDepartmentMember(
  departmentId: string,
  params: { teacherId: string; roleInDepartment: 'head' | 'member' }
): Promise<DepartmentMember> {
  const response = await fetch(`/api/departments/${departmentId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to add member');
  return json.member;
}

export async function updateDepartmentMemberRole(
  departmentId: string,
  memberId: string,
  roleInDepartment: 'head' | 'member'
): Promise<DepartmentMember> {
  const response = await fetch(`/api/departments/${departmentId}/members`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId, roleInDepartment }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to update member');
  return json.member;
}

export async function updateDepartmentMemberPermission(
  departmentId: string,
  memberId: string,
  permissionKey: DepartmentPermissionKey,
  granted: boolean
): Promise<DepartmentMember> {
  const response = await fetch(`/api/departments/${departmentId}/members`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId, permissionKey, granted }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to update member');
  return json.member;
}

export async function removeDepartmentMember(
  departmentId: string,
  memberId: string
): Promise<void> {
  const response = await fetch(`/api/departments/${departmentId}/members?memberId=${memberId}`, {
    method: 'DELETE',
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to remove member');
}
