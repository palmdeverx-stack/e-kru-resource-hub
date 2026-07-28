'use client';

export type StaffMasterCategory =
  | 'staff_type'
  | 'prefix'
  | 'position'
  | 'academic_rank'
  | 'employment_status';

export type StaffMasterItem = {
  id: string;
  category: StaffMasterCategory;
  code: string | null;
  name: string;
  name_en: string | null;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

async function readResponse(response: Response) {
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถดำเนินการได้');
  return json;
}

export async function listStaffMasterItems(): Promise<StaffMasterItem[]> {
  const response = await fetch('/api/admin/staff-masters');
  const json = await readResponse(response);
  return json.items;
}

export async function createStaffMasterItem(input: {
  category: StaffMasterCategory;
  nameTh: string;
  nameEn: string;
  sortOrder: number;
}): Promise<StaffMasterItem> {
  const response = await fetch('/api/admin/staff-masters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await readResponse(response);
  return json.item;
}

export async function updateStaffMasterItem(
  id: string,
  input: { nameTh: string; nameEn: string; sortOrder: number; isActive: boolean }
): Promise<StaffMasterItem> {
  const response = await fetch(`/api/admin/staff-masters/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await readResponse(response);
  return json.item;
}

export async function deleteStaffMasterItem(id: string): Promise<void> {
  const response = await fetch(`/api/admin/staff-masters/${id}`, { method: 'DELETE' });
  await readResponse(response);
}
