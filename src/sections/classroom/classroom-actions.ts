'use client';

// ----------------------------------------------------------------------

export type Classroom = {
  id: string;
  name: string;
  name_en: string | null;
  grade_level: string | null;
  grade_level_en: string | null;
  academic_year_id: string;
  academic_years: { year: string } | null;
  homeroom_teachers: ClassroomTeacher[];
  created_at: string;
};

export type ClassroomTeacher = {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
};

export type CreateClassroomParams = {
  name: string;
  nameEn?: string;
  gradeLevel?: string;
  gradeLevelEn?: string;
  academicYearId: string;
  teacherIds?: string[];
  subjectId?: string;
  semesterId?: string;
};

export async function listClassrooms(filters?: { academicYearId?: string }): Promise<Classroom[]> {
  const params = new URLSearchParams();
  if (filters?.academicYearId) params.set('academicYearId', filters.academicYearId);
  const query = params.size ? `?${params.toString()}` : '';
  const response = await fetch(`/api/classrooms${query}`, {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load classrooms');

  return json.classrooms;
}

export async function createClassroom(params: CreateClassroomParams) {
  const response = await fetch('/api/classrooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to create classroom');

  return json.classroom;
}

export async function updateClassroom(id: string, params: CreateClassroomParams) {
  const response = await fetch(`/api/classrooms/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to update classroom');

  return json.classroom;
}

export async function deleteClassroom(id: string): Promise<void> {
  const response = await fetch(`/api/classrooms/${id}`, {
    method: 'DELETE',
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to delete classroom');
}
