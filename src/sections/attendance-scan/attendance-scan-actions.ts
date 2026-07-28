'use client';

// ----------------------------------------------------------------------

export type AttendanceScanSessionType = 'homeroom_morning' | 'class_period' | 'homeroom_evening';

export type AttendanceScanSession = {
  id: string;
  session_type: AttendanceScanSessionType;
  classroom_id: string;
  teacher_assignment_id: string | null;
  period_label: string | null;
  session_date: string;
  opened_at: string;
  late_after: string;
  closes_at: string;
  status: 'open' | 'closed';
  classroom: {
    id: string;
    name: string;
    academic_years: { year: string } | null;
  };
  teacher_assignment: {
    id: string;
    subject: { id: string; code: string | null; name: string };
    semester: { id: string; name: string };
  } | null;
};

export type AttendanceScanEvent = {
  id: string;
  status: 'present' | 'late';
  scanned_at: string;
  student: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    student_code: string | null;
    avatar_url: string | null;
  };
};

export type AttendanceScanSessionData = {
  session: AttendanceScanSession;
  events: AttendanceScanEvent[];
};

export type AttendanceScanResult = {
  student: {
    id: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    studentCode: string | null;
    avatarUrl: string | null;
  };
  status: 'present' | 'late';
  scannedAt: string;
};

export async function createAttendanceScanSession(params: {
  sessionType: AttendanceScanSessionType;
  sessionDate: string;
  classroomId?: string;
  teacherAssignmentId?: string;
  periodLabel?: string;
  durationMinutes: number;
  lateAfterMinutes: number;
}): Promise<string> {
  const response = await fetch('/api/teacher/attendance-scan/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถเปิดรอบเช็คชื่อได้');
  return json.sessionId;
}

export async function getAttendanceScanSession(
  sessionId: string
): Promise<AttendanceScanSessionData> {
  const response = await fetch(`/api/teacher/attendance-scan/sessions/${sessionId}`, {});
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดรอบเช็คชื่อได้');
  return json;
}

export async function scanStudentQr(
  sessionId: string,
  payload: string
): Promise<AttendanceScanResult> {
  const response = await fetch(`/api/teacher/attendance-scan/sessions/${sessionId}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถบันทึก QR ได้');
  return json.result;
}

export async function closeAttendanceScanSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/teacher/attendance-scan/sessions/${sessionId}`, {
    method: 'PATCH',
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถปิดรอบเช็คชื่อได้');
}
