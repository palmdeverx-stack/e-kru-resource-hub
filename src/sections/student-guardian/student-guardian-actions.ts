'use client';

// ----------------------------------------------------------------------

export type StudentGuardian = {
  id: string;
  student_id: string;
  full_name: string;
  relationship: string;
  phone: string;
  email: string | null;
  occupation: string | null;
  address: string | null;
  notes: string | null;
  is_primary: boolean;
  line_display_name: string | null;
  line_linked_at: string | null;
  line_notifications_enabled: boolean;
};

export type GuardianInput = {
  fullName: string;
  relationship: string;
  phone: string;
  email: string;
  occupation: string;
  address: string;
  notes: string;
  isPrimary: boolean;
};

const baseUrl = (assignmentId: string | null, studentId: string) =>
  assignmentId
    ? `/api/teacher-assignments/${assignmentId}/students/${studentId}/guardians`
    : `/api/admin/students/${studentId}/guardians`;

export async function listStudentGuardians(assignmentId: string | null, studentId: string) {
  const response = await fetch(baseUrl(assignmentId, studentId), {});
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดข้อมูลผู้ปกครองได้');
  return json.guardians as StudentGuardian[];
}

export async function createStudentGuardian(
  assignmentId: string | null,
  studentId: string,
  input: GuardianInput
) {
  const response = await fetch(baseUrl(assignmentId, studentId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถเพิ่มข้อมูลผู้ปกครองได้');
  return json.guardian as StudentGuardian;
}

export async function updateStudentGuardian(
  assignmentId: string | null,
  studentId: string,
  guardianId: string,
  input: GuardianInput
) {
  const response = await fetch(`${baseUrl(assignmentId, studentId)}/${guardianId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถแก้ไขข้อมูลผู้ปกครองได้');
  return json.guardian as StudentGuardian;
}

export async function deleteStudentGuardian(
  assignmentId: string | null,
  studentId: string,
  guardianId: string
) {
  const response = await fetch(`${baseUrl(assignmentId, studentId)}/${guardianId}`, {
    method: 'DELETE',
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถลบข้อมูลผู้ปกครองได้');
}

export type GuardianLineInvitation = {
  code: string;
  expiresAt: string;
  message: string;
  addFriendUrl: string | null;
  lineChatUrl: string | null;
};

export async function createGuardianLineInvitation(guardianId: string) {
  const response = await fetch(`/api/guardians/${guardianId}/line-link`, {
    method: 'POST',
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถสร้างรหัสเชื่อม LINE ได้');
  return json as GuardianLineInvitation;
}

export type GuardianLineStatus = {
  linked: boolean;
  displayName: string | null;
  linkedAt: string | null;
  notificationsEnabled: boolean;
  invitation: {
    expiresAt: string;
    used: boolean;
    expired: boolean;
  } | null;
};

export async function getGuardianLineStatus(guardianId: string) {
  const response = await fetch(`/api/guardians/${guardianId}/line-link`, {});
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถตรวจสอบสถานะ LINE ได้');
  return json as GuardianLineStatus;
}

export async function sendGuardianLineHello(guardianId: string) {
  const response = await fetch(`/api/guardians/${guardianId}/line-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'hello' }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถส่งข้อความสวัสดีได้');
}

export async function sendGuardianProfileLink(guardianId: string) {
  const response = await fetch(`/api/guardians/${guardianId}/line-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'profile' }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถส่งลิงก์โปรไฟล์ได้');
}

export async function unlinkGuardianLine(guardianId: string) {
  const response = await fetch(`/api/guardians/${guardianId}/line-link`, {
    method: 'DELETE',
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถยกเลิกการเชื่อม LINE ได้');
}

export async function sendGuardianLineMessage(guardianId: string, text: string) {
  const response = await fetch(`/api/guardians/${guardianId}/line-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถส่งข้อความได้');
}

export async function listHomeroomStudentGuardians(studentId: string) {
  const response = await fetch(`/api/teacher/students/${studentId}/guardians`, {});
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดข้อมูลผู้ปกครองได้');
  return json.guardians as StudentGuardian[];
}
