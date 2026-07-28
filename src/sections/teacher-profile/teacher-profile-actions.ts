'use client';

import type { StaffType, EmploymentStatus } from 'src/types/staff-employment';

// ----------------------------------------------------------------------

export type TeacherProfile = {
  id: string;
  username: string;
  email: string | null;
  name_prefix: string | null;
  first_name: string | null;
  last_name: string | null;
  first_name_en: string | null;
  last_name_en: string | null;
  nickname: string | null;
  phone: string | null;
  address: string | null;
  staff_type: StaffType | null;
  staff_type_name: string | null;
  staff_type_name_en: string | null;
  employment_status: EmploymentStatus | null;
  employment_status_name: string | null;
  employment_status_name_en: string | null;
  prefix_options: Array<{
    id: string;
    name: string;
    name_en: string | null;
    is_active: boolean;
  }>;
  employment_start_date: string | null;
  appointment_date: string | null;
  contract_end_date: string | null;
  position_title: string | null;
  academic_rank: string | null;
  avatar_url: string | null;
  created_at: string;
  school: { id: string; name: string; code: string; logo_url: string | null } | null;
  summary: { assignments: number; subjects: number; classrooms: number };
  teaching_assignments: {
    id: string;
    subject: { id: string; code: string | null; name: string } | null;
    classroom: { id: string; name: string } | null;
    semester: { id: string; name: string; is_active: boolean } | null;
    schedules: Array<{ day_of_week: number; start_time: string; end_time: string }>;
  }[];
};

export type UpdateTeacherProfileParams = {
  firstName: string;
  lastName: string;
  namePrefix: string;
  firstNameEn: string;
  lastNameEn: string;
  nickname: string;
  email: string;
  phone: string;
  address: string;
};

export async function getTeacherProfile(): Promise<TeacherProfile> {
  const response = await fetch('/api/teacher/profile', {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดข้อมูลโปรไฟล์ได้');

  return json.profile;
}

export async function updateTeacherProfile(
  params: UpdateTeacherProfileParams
): Promise<TeacherProfile> {
  const response = await fetch('/api/teacher/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถบันทึกข้อมูลโปรไฟล์ได้');

  return json.profile;
}

export async function uploadTeacherAvatar(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/teacher/profile/avatar', {
    method: 'POST',
    body: formData,
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถอัปโหลดรูปโปรไฟล์ได้');
  return json.avatarUrl;
}

export async function deleteTeacherAvatar(): Promise<void> {
  const response = await fetch('/api/teacher/profile/avatar', {
    method: 'DELETE',
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถลบรูปโปรไฟล์ได้');
}
