'use client';

// ----------------------------------------------------------------------

export type HomeroomClassroom = {
  id: string;
  name: string;
  grade_level: string | null;
  academic_year_id: string;
  school_id: string;
  academic_years: { year: string } | null;
};

export type HomeroomEnrollment = {
  id: string;
  classroom_id: string;
  student_number: string | null;
  created_at: string;
  student: {
    id: string;
    username: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    student_code: string | null;
    nickname: string | null;
    student_status: 'studying' | 'graduated' | 'transferred' | 'withdrawn' | 'dismissed' | null;
    is_active: boolean;
  };
};

export type HomeroomStudentsData = {
  classrooms: HomeroomClassroom[];
  enrollments: HomeroomEnrollment[];
};

export async function getMyHomeroomStudents(): Promise<HomeroomStudentsData> {
  const response = await fetch('/api/teacher/homeroom-students', {});
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดรายชื่อนักเรียนได้');
  return json;
}

export async function addMyHomeroomStudents(classroomId: string, studentIds: string[]) {
  const response = await fetch('/api/teacher/homeroom-students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classroomId, studentIds }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถเพิ่มนักเรียนได้');
  return json.enrollments;
}

export async function updateMyHomeroomStudent(enrollmentId: string, studentNumber: string) {
  const response = await fetch('/api/teacher/homeroom-students', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrollmentId, studentNumber }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถแก้ไขเลขที่ได้');
  return json.enrollment;
}

export async function removeMyHomeroomStudent(enrollmentId: string): Promise<void> {
  const response = await fetch(
    `/api/teacher/homeroom-students?enrollmentId=${encodeURIComponent(enrollmentId)}`,
    { method: 'DELETE' }
  );
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถนำนักเรียนออกจากชั้นได้');
}
