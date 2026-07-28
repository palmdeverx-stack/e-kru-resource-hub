'use client';

// ----------------------------------------------------------------------

type Person = {
  first_name: string | null;
  last_name: string | null;
  username: string;
};

export type AdminDashboardSummary = {
  school: { id: string; name: string; code: string; logo_url: string | null };
  counts: {
    students: number;
    teachers: number;
    classrooms: number;
    subjects: number;
    enrollments: number;
  };
  academicYear: {
    id: string;
    year: string;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    semesters: Array<{
      id: string;
      name: string;
      is_active: boolean;
      start_date: string | null;
      end_date: string | null;
    }>;
  } | null;
};

export type AdminDashboardRecentActivity = {
  recentAssignments: Array<{
    id: string;
    created_at: string;
    teacher: Person;
    subject: { name: string; code: string | null };
    classroom: { name: string };
    semester: { name: string };
  }>;
  recentEnrollments: Array<{
    id: string;
    created_at: string;
    student_number: string | null;
    student: Person;
    classroom: { name: string };
  }>;
};

export type EnrolledStudentExportRow = {
  id: string;
  student_number: string | null;
  created_at: string;
  student: {
    id: string;
    username: string;
    email: string | null;
    student_code: string | null;
    national_id: string | null;
    name_prefix: string | null;
    first_name: string | null;
    last_name: string | null;
    first_name_en: string | null;
    last_name_en: string | null;
    nickname: string | null;
    gender: 'male' | 'female' | 'other' | 'unspecified' | null;
    birth_date: string | null;
    nationality: string | null;
    ethnicity: string | null;
    religion: string | null;
    student_status: string | null;
    is_active: boolean;
  };
  classroom: {
    id: string;
    name: string;
    name_en: string | null;
    grade_level: string | null;
    grade_level_en: string | null;
    academic_year: { id: string; year: string } | null;
  };
};

async function fetchJson<T>(url: string, errorMessage: string): Promise<T> {
  const response = await fetch(url);
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? errorMessage);
  return json;
}

export function getAdminDashboardSummary() {
  return fetchJson<AdminDashboardSummary>(
    '/api/admin/dashboard/summary',
    'Failed to load dashboard'
  );
}

export function getAdminDashboardRecentActivity() {
  return fetchJson<AdminDashboardRecentActivity>(
    '/api/admin/dashboard/recent-activity',
    'Failed to load recent activity'
  );
}

export async function getEnrolledStudentsForExport(): Promise<EnrolledStudentExportRow[]> {
  const response = await fetch('/api/admin/dashboard/enrolled-students');
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดข้อมูลนักเรียนได้');
  return json.enrollments;
}
