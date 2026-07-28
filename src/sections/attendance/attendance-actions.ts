'use client';

// ----------------------------------------------------------------------

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'late';

export type AttendanceEntry = {
  id: string | null;
  status: AttendanceStatus;
  note: string | null;
};

export type AttendanceRow = {
  student: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  studentNumber: string | null;
  attendance: AttendanceEntry;
};

export type AttendanceSheet = {
  sessionDate: string;
  rows: AttendanceRow[];
};

export type SaveAttendanceRecord = {
  studentId: string;
  status: AttendanceStatus;
  note?: string | null;
};

export type StudentAttendanceRecord = {
  id: string;
  session_date: string;
  status: AttendanceStatus;
  note: string | null;
  teacher_assignment: {
    subjects: { name: string; code: string } | null;
    classrooms: { name: string } | null;
  } | null;
};

export async function getAttendance(
  teacherAssignmentId: string,
  sessionDate: string
): Promise<AttendanceSheet> {
  const response = await fetch(
    `/api/teacher-assignments/${teacherAssignmentId}/attendance?date=${sessionDate}`,
    {}
  );
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load attendance');

  return json;
}

export async function saveAttendance(
  teacherAssignmentId: string,
  sessionDate: string,
  records: SaveAttendanceRecord[]
) {
  const response = await fetch(`/api/teacher-assignments/${teacherAssignmentId}/attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionDate, records }),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to save attendance');

  return json.records;
}

export async function getMyAttendance(): Promise<StudentAttendanceRecord[]> {
  const response = await fetch('/api/student/attendance', {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load attendance');

  return json.records;
}
