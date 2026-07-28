'use client';

import type {
  HomeroomAttendancePeriod,
  HomeroomAttendanceStatus,
} from './homeroom-attendance-actions';

export type HomeroomAttendanceHistoryRecord = {
  id: string;
  attendanceDate: string;
  period: HomeroomAttendancePeriod;
  status: HomeroomAttendanceStatus;
  note: string | null;
  updatedAt: string;
  classroom: {
    id: string;
    name: string;
    grade_level: string | null;
    academic_years: { year: string } | null;
  };
  student: {
    id: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    nickname: string | null;
    studentCode: string | null;
    avatarUrl: string | null;
  };
};

export type HomeroomAttendanceHistoryFilters = {
  classroomId?: string;
  studentId?: string;
  startDate: string;
  endDate: string;
  period?: HomeroomAttendancePeriod;
  status?: HomeroomAttendanceStatus;
  page?: number;
  pageSize?: number;
};

export type HomeroomAttendanceHistoryData = {
  records: HomeroomAttendanceHistoryRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export async function getHomeroomAttendanceHistory(
  filters: HomeroomAttendanceHistoryFilters
): Promise<HomeroomAttendanceHistoryData> {
  const params = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
    page: String(filters.page ?? 1),
    pageSize: String(filters.pageSize ?? 25),
  });
  if (filters.classroomId) params.set('classroomId', filters.classroomId);
  if (filters.studentId) params.set('studentId', filters.studentId);
  if (filters.period) params.set('period', filters.period);
  if (filters.status) params.set('status', filters.status);

  const response = await fetch(`/api/teacher/homeroom-attendance/history?${params}`, {});
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดประวัติการเข้าแถวได้');
  return json;
}

export async function getAllHomeroomAttendanceHistory(
  filters: Omit<HomeroomAttendanceHistoryFilters, 'page' | 'pageSize'>
) {
  const pageSize = 500;
  const firstPage = await getHomeroomAttendanceHistory({ ...filters, page: 1, pageSize });
  const records = [...firstPage.records];
  const totalPages = Math.ceil(firstPage.total / pageSize);

  for (let page = 2; page <= totalPages; page += 1) {
    const result = await getHomeroomAttendanceHistory({ ...filters, page, pageSize });
    records.push(...result.records);
  }

  return records;
}
