'use client';

import type { StaffType, EmploymentStatus } from 'src/types/staff-employment';

// ----------------------------------------------------------------------

export type UserRole = 'master_admin' | 'school_admin' | 'teacher' | 'student';

export type StudentStatus = 'studying' | 'graduated' | 'transferred' | 'withdrawn' | 'dismissed';

export type UserRow = {
  id: string;
  username: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  school_id: string | null;
  school: { name: string } | null;
  created_at: string;
  must_change_password?: boolean;
  login_password?: string | null;
  student_status?: StudentStatus | null;
  student_code?: string | null;
  national_id?: string | null;
  name_prefix?: string | null;
  first_name_en?: string | null;
  last_name_en?: string | null;
  nickname?: string | null;
  gender?: 'male' | 'female' | 'other' | 'unspecified' | null;
  birth_date?: string | null;
  nationality?: string | null;
  ethnicity?: string | null;
  religion?: string | null;
  is_active?: boolean;
  guardian_count?: number;
  line_guardian_count?: number;
  line_notifications_enabled_count?: number;
  import_confirmed_at?: string | null;
  is_school_director?: boolean;
  staff_type?: StaffType | null;
  employment_status?: EmploymentStatus | null;
  employment_start_date?: string | null;
  appointment_date?: string | null;
  contract_end_date?: string | null;
  position_title?: string | null;
  academic_rank?: string | null;
  line_linked_at?: string | null;
  line_display_name?: string | null;
};

export type CreateUserParams = {
  username: string;
  email?: string;
  password?: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  schoolId?: string;
  studentCode?: string;
  nationalId?: string;
  namePrefix?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  nickname?: string;
  gender?: 'male' | 'female' | 'other' | 'unspecified';
  birthDate?: string;
  nationality?: string;
  ethnicity?: string;
  religion?: string;
  pendingConfirmation?: boolean;
  guardian?: {
    fullName: string;
    relationship: string;
    phone: string;
    email: string;
    occupation: string;
    address: string;
    notes: string;
    isPrimary: boolean;
  };
  staffType?: StaffType;
  employmentStatus?: EmploymentStatus;
  employmentStartDate?: string;
  appointmentDate?: string;
  contractEndDate?: string;
  positionTitle?: string;
  academicRank?: string;
};

export type UpdateStudentProfileParams = Omit<
  CreateUserParams,
  'role' | 'schoolId' | 'pendingConfirmation' | 'guardian'
>;

export type UpdateSchoolAdminParams = {
  username: string;
  email?: string;
  password?: string;
  firstName: string;
  lastName: string;
  schoolId: string;
};

/** **************************************
 * List users — school admin sees their own school, master admin sees
 * school admins (or pass `role` to filter, e.g. for select dropdowns)
 *************************************** */
export async function listUsers(role?: UserRole): Promise<UserRow[]> {
  const url = role ? `/api/admin/users?role=${role}` : '/api/admin/users';
  const response = await fetch(url, {});
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message ?? 'Failed to load users');
  }

  return json.users;
}

export async function getManagedUser(id: string): Promise<UserRow> {
  const response = await fetch(`/api/admin/users/${id}`);
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message ?? 'ไม่สามารถโหลดข้อมูลครู/บุคลากรได้');
  }

  return json.user as UserRow;
}

/** **************************************
 * Create user
 *************************************** */
export async function createUser(params: CreateUserParams) {
  const response = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message ?? 'Failed to create user');
  }

  return json.user;
}

/** **************************************
 * Bulk import students from Excel
 *************************************** */
export type BulkImportStudentRow = {
  row: number;
  studentCode?: string;
  nationalId?: string;
  namePrefix?: string;
  firstName?: string;
  lastName?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  nickname?: string;
  gender?: string;
  birthDate?: string;
  nationality?: string;
  ethnicity?: string;
  religion?: string;
  username?: string;
  email?: string;
  password?: string;
};

export type BulkImportResult = {
  results: Array<{ row: number; success: boolean; studentCode?: string; message?: string }>;
  successCount: number;
  failureCount: number;
};

export async function bulkImportStudents(
  rows: BulkImportStudentRow[]
): Promise<BulkImportResult> {
  const response = await fetch('/api/admin/users/bulk-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message ?? 'Failed to import students');
  }

  return json;
}

export async function confirmStudentImport(ids: string[]): Promise<number> {
  const response = await fetch('/api/admin/students/confirm-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message ?? 'Failed to confirm students');
  }

  return json.confirmedCount;
}

export async function updateSchoolAdmin(id: string, params: UpdateSchoolAdminParams) {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to update school admin');
  return json.user;
}

export async function deleteSchoolAdmin(id: string): Promise<void> {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: 'DELETE',
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to delete school admin');
}

export async function getStudent(id: string): Promise<UserRow> {
  const response = await fetch(`/api/admin/students/${id}`);
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load student');
  return json.student as UserRow;
}

export async function updateStudentProfile(id: string, params: UpdateStudentProfileParams) {
  const response = await fetch(`/api/admin/students/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to update student');
  return json.student as UserRow;
}

export async function uploadStudentAvatar(studentId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/api/admin/students/${studentId}/avatar`, {
    method: 'POST',
    body: formData,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถอัปโหลดรูปนักเรียนได้');
  return json.avatarUrl;
}

export async function deleteStudentAvatar(studentId: string): Promise<void> {
  const response = await fetch(`/api/admin/students/${studentId}/avatar`, {
    method: 'DELETE',
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถลบรูปนักเรียนได้');
}

export async function updateStudentStatus(
  studentId: string,
  status: StudentStatus
): Promise<StudentStatus> {
  const response = await fetch(`/api/admin/students/${studentId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถเปลี่ยนสถานะนักเรียนได้');
  return json.student.student_status;
}

export async function updateUserActive(id: string, isActive: boolean): Promise<boolean> {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถเปลี่ยนสถานะบัญชีได้');
  return json.user.is_active;
}

export async function updateSchoolDirector(id: string, isSchoolDirector: boolean): Promise<boolean> {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isSchoolDirector }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถเปลี่ยนสิทธิ์ผู้อำนวยการได้');
  return json.user.is_school_director;
}

export async function deleteManagedUser(id: string): Promise<void> {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: 'DELETE',
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถลบบัญชีได้');
}

export async function updateStaffUser(
  id: string,
  params: Omit<CreateUserParams, 'role' | 'schoolId'>
) {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถแก้ไขบัญชีได้');
  return json.user as UserRow;
}
