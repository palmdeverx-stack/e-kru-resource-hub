'use client';

// ----------------------------------------------------------------------

export type GuardianAttendanceStatus = 'present' | 'absent' | 'leave' | 'late';

type GuardianClassAttendance = {
  id: string;
  date: string;
  period: string;
  status: GuardianAttendanceStatus;
  note: string | null;
  assignment: {
    subject:
      | { name: string; code: string | null }
      | Array<{ name: string; code: string | null }>
      | null;
    classroom: { name: string } | Array<{ name: string }> | null;
  } | null;
};

type GuardianHomeroomAttendance = {
  id: string;
  date: string;
  period: 'morning' | 'evening';
  status: GuardianAttendanceStatus;
  note: string | null;
  classroom: { name: string } | null;
};

export type GuardianStudentProfile = {
  id: string;
  name_prefix: string | null;
  first_name: string | null;
  last_name: string | null;
  first_name_en: string | null;
  last_name_en: string | null;
  nickname: string | null;
  avatar_url: string | null;
  student_status: 'studying' | 'graduated' | 'transferred' | 'withdrawn' | 'dismissed' | null;
  student_code: string | null;
  birth_date: string | null;
  gender: 'male' | 'female' | 'other' | 'unspecified' | null;
  nationality: string | null;
  religion: string | null;
  guardian: { fullName: string; relationship: string } | null;
  enrollment: {
    student_number: string | null;
    classroom:
      | {
          id: string;
          name: string;
          grade_level: string | null;
          academic_year: { year: string; is_active: boolean } | null;
        }
      | Array<{
          id: string;
          name: string;
          grade_level: string | null;
          academic_year: { year: string; is_active: boolean } | null;
        }>
      | null;
  } | null;
  attendance: {
    classes: GuardianClassAttendance[];
    homeroom: GuardianHomeroomAttendance[];
  };
};

export type GuardianProfileResponse = {
  school: { id: string; name: string; code: string; logo_url: string | null } | null;
  students: GuardianStudentProfile[];
};

export class GuardianPortalError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GuardianPortalError';
    this.status = status;
  }
}

export async function getGuardianProfile(): Promise<GuardianProfileResponse> {
  const response = await fetch('/api/guardian/profile', { credentials: 'same-origin' });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new GuardianPortalError(
      json?.message ?? 'ไม่สามารถโหลดข้อมูลนักเรียนได้',
      response.status
    );
  }
  return json;
}

async function portalRequest(url: string, body: Record<string, string>) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new GuardianPortalError(json?.message ?? 'ไม่สามารถดำเนินการได้', response.status);
  }
  return json;
}

export async function loginGuardianPortal(studentCode: string) {
  return portalRequest('/api/guardian/portal/login', { studentCode }) as Promise<{
    success: boolean;
  }>;
}

export async function logoutGuardianPortal() {
  await fetch('/api/guardian/portal/login', {
    method: 'DELETE',
    credentials: 'same-origin',
  });
}
