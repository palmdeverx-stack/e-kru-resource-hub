'use client';

import type { SubmissionStatus } from 'src/sections/gradebook/gradebook-actions';

// ----------------------------------------------------------------------

export type TeacherAssignment = {
  id: string;
  created_at: string;
  teacher: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  subject: {
    id: string;
    code: string | null;
    name: string;
    image_url: string | null;
    academic_year_id: string;
    semester_id: string;
  };
  classroom: { id: string; name: string; academic_year_id: string };
  semester: { id: string; name: string; academic_year_id: string };
};

export type CreateTeacherAssignmentParams = {
  teacherId: string;
  subjectId: string;
  classroomId: string;
  semesterId: string;
};

export type TeacherAssignmentPage = {
  teacherAssignments: TeacherAssignment[];
  total: number;
  hasMore: boolean;
};

export type TeacherAssignmentSummary = {
  classes: number;
  subjects: number;
  classrooms: number;
  semesters: number;
  classroomOptions: Array<{ id: string; name: string }>;
};

export type RosterStudent = {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export type RosterRow = {
  id: string;
  student_number: string | null;
  student: RosterStudent;
};

export type Roster = {
  roster: RosterRow[];
  subjectId: string;
  classroomName: string | null;
  subjectName: string | null;
  subjectCode: string | null;
  credits: number;
  subjectImageUrl: string | null;
  academicYear: string | null;
  semesterName: string | null;
  semesterIsActive: boolean;
  teacher: { username: string; first_name: string | null; last_name: string | null } | null;
};

export type StudentBreakdownRow = {
  assignment: {
    id: string;
    title: string;
    full_score: number;
    category: 'assignment' | 'quiz' | 'midterm' | 'final' | 'other';
  };
  score: { score: number | null; feedback: string | null; status: SubmissionStatus };
};

export type StudentBreakdown = {
  student: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    student_number: string | null;
  };
  rows: StudentBreakdownRow[];
};

export type ScheduleSlot = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type CreateScheduleParams = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export async function listTeacherAssignmentsPage(params: {
  classroomId?: string;
  search?: string;
  limit: number;
  offset: number;
}): Promise<TeacherAssignmentPage> {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.classroomId) query.set('classroomId', params.classroomId);
  if (params.search) query.set('search', params.search);

  const response = await fetch(`/api/teacher-assignments?${query.toString()}`, {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load teacher assignments');

  return json;
}

export async function getTeacherAssignmentSummary(): Promise<TeacherAssignmentSummary> {
  const response = await fetch('/api/teacher-assignments/summary', {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load teacher assignment summary');

  return json;
}

// Small, bounded pickers (e.g. a teacher's own subject dropdown) that need
// the full list rather than a paginated page: reuse the paginated endpoint
// with the max page size instead of adding a separate unpaginated route.
export async function listTeacherAssignments(): Promise<TeacherAssignment[]> {
  const page = await listTeacherAssignmentsPage({ limit: 50, offset: 0 });
  return page.teacherAssignments;
}

export async function getRoster(teacherAssignmentId: string): Promise<Roster> {
  const response = await fetch(`/api/teacher-assignments/${teacherAssignmentId}/roster`, {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load roster');

  return json;
}

export async function getStudentBreakdown(
  teacherAssignmentId: string,
  studentId: string
): Promise<StudentBreakdown> {
  const response = await fetch(
    `/api/teacher-assignments/${teacherAssignmentId}/students/${studentId}`,
    {}
  );
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load student breakdown');

  return json;
}

export async function getSchedules(teacherAssignmentId: string): Promise<ScheduleSlot[]> {
  const response = await fetch(`/api/teacher-assignments/${teacherAssignmentId}/schedules`, {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load schedules');

  return json.schedules;
}

export async function createSchedule(teacherAssignmentId: string, params: CreateScheduleParams) {
  const response = await fetch(`/api/teacher-assignments/${teacherAssignmentId}/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to create schedule');

  return json.schedule;
}

export async function updateSchedule(
  teacherAssignmentId: string,
  scheduleId: string,
  params: CreateScheduleParams
) {
  const response = await fetch(
    `/api/teacher-assignments/${teacherAssignmentId}/schedules/${scheduleId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }
  );
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to update schedule');

  return json.schedule;
}

export async function deleteSchedule(
  teacherAssignmentId: string,
  scheduleId: string
): Promise<void> {
  const response = await fetch(
    `/api/teacher-assignments/${teacherAssignmentId}/schedules/${scheduleId}`,
    { method: 'DELETE' }
  );
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to delete schedule');
}

export async function createTeacherAssignment(params: CreateTeacherAssignmentParams) {
  const response = await fetch('/api/teacher-assignments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to create teacher assignment');

  return json.teacherAssignment;
}

export async function updateTeacherAssignment(id: string, params: CreateTeacherAssignmentParams) {
  const response = await fetch(`/api/teacher-assignments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to update teacher assignment');

  return json.teacherAssignment;
}

export async function deleteTeacherAssignment(id: string): Promise<void> {
  const response = await fetch(`/api/teacher-assignments/${id}`, {
    method: 'DELETE',
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to delete teacher assignment');
}
