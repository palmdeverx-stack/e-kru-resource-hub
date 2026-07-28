'use client';

export type HomeroomAttendancePeriod = 'morning' | 'evening';
export type HomeroomAttendanceStatus = 'present' | 'absent' | 'leave' | 'late';

export type HomeroomAttendanceRow = {
  studentNumber: string | null;
  student: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    student_code: string | null;
    is_active: boolean;
    student_status: string | null;
  };
  attendance: {
    id: string | null;
    status: HomeroomAttendanceStatus;
    note: string | null;
    recorded_by: string | null;
    updated_at: string | null;
  };
};

export type HomeroomAttendanceData = {
  classroom: { id: string; name: string };
  attendanceDate: string;
  period: HomeroomAttendancePeriod;
  rows: HomeroomAttendanceRow[];
};

export type HomeroomAttendanceRecord = {
  studentId: string;
  status: HomeroomAttendanceStatus;
  note: string | null;
};

export async function getHomeroomAttendance(
  classroomId: string,
  date: string,
  period: HomeroomAttendancePeriod
): Promise<HomeroomAttendanceData> {
  const params = new URLSearchParams({ classroomId, date, period });
  const response = await fetch(`/api/teacher/homeroom-attendance?${params}`, {});
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดข้อมูลเช็คชื่อเข้าแถวได้');
  return json;
}

export async function saveHomeroomAttendance(
  classroomId: string,
  date: string,
  period: HomeroomAttendancePeriod,
  records: HomeroomAttendanceRecord[]
) {
  const response = await fetch('/api/teacher/homeroom-attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classroomId, date, period, records }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถบันทึกเช็คชื่อเข้าแถวได้');
  return json.records;
}
