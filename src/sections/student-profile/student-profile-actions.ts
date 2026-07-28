'use client';

// ----------------------------------------------------------------------

export type StudentProfile = {
  id: string;
  username: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  student_status: 'studying' | 'graduated' | 'transferred' | 'withdrawn' | 'dismissed' | null;
  created_at: string;
  school: { id: string; name: string; code: string; logo_url: string | null } | null;
  semester: {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
  } | null;
  guardians: Array<{
    id: string;
    full_name: string;
    relationship: string;
    phone: string;
    email: string | null;
    occupation: string | null;
    address: string | null;
    notes: string | null;
    is_primary: boolean;
  }>;
  enrollment: {
    id: string;
    student_number: string | null;
    classroom: {
      name: string;
      grade_level: string | null;
      academic_year: { year: string; start_date: string | null; end_date: string | null } | null;
    } | null;
  } | null;
};

export async function getStudentProfile(): Promise<StudentProfile> {
  const response = await fetch('/api/student/profile', {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดข้อมูลโปรไฟล์ได้');

  return json.profile;
}
