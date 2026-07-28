'use client';

export type TeacherLineInvitation = {
  code: string;
  expiresAt: string;
  message: string;
  addFriendUrl: string | null;
  lineChatUrl: string | null;
};

export type TeacherLineStatus = {
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

export async function getTeacherLineStatus(): Promise<TeacherLineStatus> {
  const response = await fetch('/api/teacher/line-link', {});
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถตรวจสอบสถานะ LINE ได้');
  return json as TeacherLineStatus;
}

export async function createTeacherLineInvitation(): Promise<TeacherLineInvitation> {
  const response = await fetch('/api/teacher/line-link', { method: 'POST' });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถสร้างรหัสเชื่อม LINE ได้');
  return json as TeacherLineInvitation;
}

export async function unlinkTeacherLine(): Promise<void> {
  const response = await fetch('/api/teacher/line-link', { method: 'DELETE' });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถยกเลิกการเชื่อม LINE ได้');
}
