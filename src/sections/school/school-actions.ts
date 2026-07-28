'use client';

// ----------------------------------------------------------------------

export type School = {
  id: string;
  name: string;
  name_en: string | null;
  code: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  subscription: {
    plan_name: string;
    status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled';
    ends_at: string | null;
  } | null;
  teacherCount: number;
  studentCount: number;
  classroomCount: number;
  subjectCount: number;
};

export type SchoolProfile = {
  id: string;
  name: string;
  name_en: string | null;
  code: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type CreateSchoolParams = {
  name: string;
  nameEn?: string;
  code: string;
  email: string;
};

export type CreateSchoolResult = {
  school: School;
  adminCreated: boolean;
  emailSent?: boolean;
  adminUsername?: string;
  /** Only present when the invite email failed to send. */
  adminPassword?: string;
  message?: string;
};

export async function listSchools(): Promise<School[]> {
  const response = await fetch('/api/schools', {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load schools');

  return json.schools;
}

export async function createSchool(params: CreateSchoolParams): Promise<CreateSchoolResult> {
  const response = await fetch('/api/schools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to create school');

  return json;
}

export async function toggleSchoolActive(id: string, isActive: boolean) {
  const response = await fetch(`/api/schools/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive }),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to update school');

  return json.school;
}

export async function getSchool(id: string): Promise<SchoolProfile> {
  const response = await fetch(`/api/schools/${id}`, {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load school');

  return json.school;
}

export async function updateSchool(
  id: string,
  params: { name?: string; nameEn?: string; code?: string }
): Promise<SchoolProfile> {
  const response = await fetch(`/api/schools/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to update school');

  return json.school;
}

export async function deleteSchool(id: string): Promise<void> {
  const response = await fetch(`/api/schools/${id}`, {
    method: 'DELETE',
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to delete school');
}

export async function uploadSchoolLogo(id: string, file: File): Promise<SchoolProfile> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/api/schools/${id}/logo`, {
    method: 'POST',
    body: formData,
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to upload logo');

  return json.school;
}

export type SchoolTeacherRoster = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  position_title: string | null;
  academic_rank: string | null;
  department_name: string | null;
  role_in_department: 'head' | 'member' | null;
  homeroom_classrooms: { name: string; grade_level: string | null }[];
};

export async function listSchoolTeachers(id: string): Promise<SchoolTeacherRoster[]> {
  const response = await fetch(`/api/schools/${id}/teachers`, {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load teacher roster');

  return json.teachers;
}
