'use client';

// ----------------------------------------------------------------------

export type AcademicYear = {
  id: string;
  year: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
};

export type Semester = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  grade_submission_deadline: string | null;
  grade_reminder_days: number | null;
  grade_reminder_notify_in_app: boolean;
  grade_reminder_notify_line: boolean;
  created_at: string;
};

export async function listAcademicYears(): Promise<AcademicYear[]> {
  const response = await fetch('/api/academic-years', {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load academic years');

  return json.academicYears;
}

export type SaveAcademicYearParams = {
  year: string;
  startDate: string;
  endDate: string;
  isActive?: boolean;
};

export async function createAcademicYear(params: SaveAcademicYearParams): Promise<AcademicYear> {
  const response = await fetch('/api/academic-years', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to create academic year');

  return json.academicYear;
}

export async function updateAcademicYear(
  id: string,
  params: SaveAcademicYearParams
): Promise<AcademicYear> {
  const response = await fetch(`/api/academic-years/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to update academic year');

  return json.academicYear;
}

export async function deleteAcademicYear(id: string): Promise<void> {
  const response = await fetch(`/api/academic-years/${id}`, {
    method: 'DELETE',
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to delete academic year');
}

export async function listSemesters(academicYearId: string): Promise<Semester[]> {
  const response = await fetch(`/api/semesters?academicYearId=${academicYearId}`, {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load semesters');

  return json.semesters;
}

export type SaveSemesterParams = {
  academicYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive?: boolean;
  gradeSubmissionDeadline?: string;
  gradeReminderDays?: number;
  gradeReminderNotifyInApp?: boolean;
  gradeReminderNotifyLine?: boolean;
};

export async function createSemester(params: SaveSemesterParams): Promise<Semester> {
  const response = await fetch('/api/semesters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to create semester');

  return json.semester;
}

export async function updateSemester(
  id: string,
  params: Omit<SaveSemesterParams, 'academicYearId'>
): Promise<Semester> {
  const response = await fetch(`/api/semesters/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to update semester');

  return json.semester;
}

export async function deleteSemester(id: string): Promise<void> {
  const response = await fetch(`/api/semesters/${id}`, {
    method: 'DELETE',
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to delete semester');
}
