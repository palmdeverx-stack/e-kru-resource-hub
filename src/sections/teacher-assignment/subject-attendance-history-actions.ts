'use client';

// ----------------------------------------------------------------------

export type SubjectAttendanceStatus = 'present' | 'absent' | 'leave' | 'late';
export type SubjectAttendanceSource = 'daily' | 'qr';

export type SubjectAttendanceHistoryRecord = {
  id: string;
  attendanceDate: string;
  periodKey: string;
  status: SubjectAttendanceStatus;
  note: string | null;
  updatedAt: string;
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

export type SubjectAttendanceHistoryFilters = {
  studentId?: string;
  startDate: string;
  endDate: string;
  status?: SubjectAttendanceStatus;
  source?: SubjectAttendanceSource;
  page?: number;
  pageSize?: number;
};

export type SubjectAttendanceHistoryData = {
  records: SubjectAttendanceHistoryRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export async function getSubjectAttendanceHistory(
  teacherAssignmentId: string,
  filters: SubjectAttendanceHistoryFilters
): Promise<SubjectAttendanceHistoryData> {
  const params = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
    page: String(filters.page ?? 1),
    pageSize: String(filters.pageSize ?? 25),
  });
  if (filters.studentId) params.set('studentId', filters.studentId);
  if (filters.status) params.set('status', filters.status);
  if (filters.source) params.set('source', filters.source);

  const response = await fetch(
    `/api/teacher-assignments/${teacherAssignmentId}/attendance/history?${params}`,
    {}
  );
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดประวัติการเข้าเรียนได้');
  return json;
}

export async function getAllSubjectAttendanceHistory(
  teacherAssignmentId: string,
  filters: Omit<SubjectAttendanceHistoryFilters, 'page' | 'pageSize'>
) {
  const pageSize = 500;
  const firstPage = await getSubjectAttendanceHistory(teacherAssignmentId, {
    ...filters,
    page: 1,
    pageSize,
  });
  const records = [...firstPage.records];
  const totalPages = Math.ceil(firstPage.total / pageSize);

  for (let page = 2; page <= totalPages; page += 1) {
    const result = await getSubjectAttendanceHistory(teacherAssignmentId, {
      ...filters,
      page,
      pageSize,
    });
    records.push(...result.records);
  }
  return records;
}
