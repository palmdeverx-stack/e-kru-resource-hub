'use client';

// ----------------------------------------------------------------------

type Subject = { id: string; code: string | null; name: string; image_url: string | null } | null;
type Classroom = {
  id: string;
  name: string;
  grade_level: string | null;
  academic_year: { year: string } | null;
} | null;
type Semester = { id: string; name: string; is_active: boolean } | null;

export type TeacherDashboardSummary = {
  teacher: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
  };
  school: { id: string; name: string; code: string; logo_url: string | null } | null;
  summary: {
    teaching_assignments: number;
    subjects: number;
    classrooms: number;
    students: number;
    assignments: number;
    waiting_to_grade: number;
  };
  today_schedules: Array<{
    id: string;
    teacher_assignment_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    subject: Subject;
    classroom: Classroom;
    semester: Semester;
  }>;
};

export type TeacherDashboardRecentAssignments = {
  recent_assignments: Array<{
    id: string;
    teacher_assignment_id: string;
    title: string;
    full_score: number;
    category: 'assignment' | 'quiz' | 'midterm' | 'final' | 'other';
    created_at: string;
    subject: Subject;
    classroom: Classroom;
    semester: Semester;
    student_count: number;
    submitted_count: number;
    graded_count: number;
  }>;
};

async function fetchJson<T>(url: string, errorMessage: string): Promise<T> {
  const response = await fetch(url);
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? errorMessage);

  return json;
}

export function getTeacherDashboardSummary() {
  return fetchJson<TeacherDashboardSummary>(
    '/api/teacher/dashboard/summary',
    'ไม่สามารถโหลดแดชบอร์ดครูได้'
  );
}

export function getTeacherDashboardRecentAssignments() {
  return fetchJson<TeacherDashboardRecentAssignments>(
    '/api/teacher/dashboard/recent-assignments',
    'ไม่สามารถโหลดงานที่มอบหมายล่าสุดได้'
  );
}

export function getTeacherDashboardSummaryFor(teacherId: string) {
  return fetchJson<TeacherDashboardSummary>(
    `/api/teachers/${teacherId}/dashboard-summary`,
    'ไม่สามารถโหลดข้อมูลการสอนของครูคนนี้ได้'
  );
}
