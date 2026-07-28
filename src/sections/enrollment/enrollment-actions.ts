'use client';

// ----------------------------------------------------------------------

export type Enrollment = {
  id: string;
  student_number: string | null;
  created_at: string;
  student: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    student_status: 'studying' | 'graduated' | 'transferred' | 'withdrawn' | 'dismissed' | null;
    is_active: boolean;
  };
  classroom: {
    id: string;
    name: string;
    academic_year_id: string;
    academic_years: { year: string } | null;
  };
};

export type CreateEnrollmentParams = {
  studentId: string;
  classroomId: string;
  studentNumber?: string;
};

export type CreateEnrollmentsParams = {
  studentIds: string[];
  classroomId: string;
};

export type BulkPromoteEntry = {
  studentId: string;
  classroomId: string;
  studentNumber?: string;
};

export type ProgressStatus =
  | 'submitted'
  | 'late'
  | 'not_submitted'
  | 'absent'
  | 'sick_leave'
  | 'pending_review';

export type EnrollmentProgress = {
  enrollment: {
    id: string;
    student_number: string | null;
    student: Enrollment['student'];
    classroom: { id: string; name: string; academic_years: { year: string } | null };
  };
  subjects: Array<{
    id: string;
    teacher: { id: string; username: string; first_name: string | null; last_name: string | null };
    subject: {
      id: string;
      code: string | null;
      name: string;
      credits: number;
      image_url: string | null;
    };
    semester: { id: string; name: string };
    assignments: Array<{
      id: string;
      title: string;
      description: string | null;
      full_score: number;
      created_at: string;
      score: number | null;
      feedback: string | null;
      status: ProgressStatus;
    }>;
  }>;
};

export async function listEnrollments(params?: {
  classroomId?: string;
  studentId?: string;
  academicYearId?: string;
}): Promise<Enrollment[]> {
  const query = new URLSearchParams();
  if (params?.classroomId) query.set('classroomId', params.classroomId);
  if (params?.studentId) query.set('studentId', params.studentId);
  if (params?.academicYearId) query.set('academicYearId', params.academicYearId);

  const response = await fetch(`/api/enrollments?${query.toString()}`, {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load enrollments');

  return json.enrollments;
}

export async function createEnrollment(params: CreateEnrollmentParams) {
  const response = await fetch('/api/enrollments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to create enrollment');

  return json.enrollment;
}

export async function createEnrollments(params: CreateEnrollmentsParams) {
  const response = await fetch('/api/enrollments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถเพิ่มนักเรียนเข้าห้องได้');
  return json.enrollments as Enrollment[];
}

export async function updateEnrollment(
  id: string,
  params: Pick<CreateEnrollmentParams, 'classroomId' | 'studentNumber'>
) {
  const response = await fetch(`/api/enrollments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถแก้ไขการลงทะเบียนได้');
  return json.enrollment;
}

export async function deleteEnrollment(id: string): Promise<void> {
  const response = await fetch(`/api/enrollments/${id}`, {
    method: 'DELETE',
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถลบการลงทะเบียนได้');
}

export async function bulkPromoteEnrollments(params: {
  sourceClassroomId: string;
  entries: BulkPromoteEntry[];
}) {
  const response = await fetch('/api/enrollments/bulk-promote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to promote students');

  return json.enrollments as Enrollment[];
}

export async function getEnrollmentProgress(id: string): Promise<EnrollmentProgress> {
  const response = await fetch(`/api/enrollments/${id}/progress`, {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load student progress');
  return json;
}
