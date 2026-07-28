'use client';

export type SubjectMasterCategory = 'learning_area' | 'subject_type' | 'education_stage';

export type SubjectMasterItem = {
  id: string;
  category: SubjectMasterCategory;
  code: string;
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

export async function listSubjectMasterItems(): Promise<SubjectMasterItem[]> {
  const response = await fetch('/api/admin/subject-masters');
  const json = await readResponse(response);
  return json.items;
}

export async function createSubjectMasterItem(input: {
  category: SubjectMasterCategory;
  nameTh: string;
  nameEn: string;
  sortOrder: number;
}): Promise<SubjectMasterItem> {
  const response = await fetch('/api/admin/subject-masters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await readResponse(response);
  return json.item;
}

export async function updateSubjectMasterItem(
  id: string,
  input: { nameTh: string; nameEn: string; sortOrder: number; isActive: boolean }
): Promise<SubjectMasterItem> {
  const response = await fetch(`/api/admin/subject-masters/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await readResponse(response);
  return json.item;
}

export async function deleteSubjectMasterItem(id: string): Promise<void> {
  const response = await fetch(`/api/admin/subject-masters/${id}`, { method: 'DELETE' });
  await readResponse(response);
}
