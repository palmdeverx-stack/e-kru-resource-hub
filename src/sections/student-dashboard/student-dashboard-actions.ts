'use client';

// ----------------------------------------------------------------------

export type SubmissionStatus =
  | 'submitted'
  | 'late'
  | 'not_submitted'
  | 'absent'
  | 'sick_leave'
  | 'pending_review';

export type StudentPerson = {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export type StudentClassroom = {
  id: string;
  name: string;
  grade_level: string | null;
  academic_year: {
    id: string;
    year: string;
    is_active: boolean;
    start_date: string | null;
    end_date: string | null;
  } | null;
};

export type StudentSubject = {
  id: string;
  teacher: StudentPerson;
  subject: {
    id: string;
    code: string | null;
    name: string;
    credits: number;
    description: string | null;
    image_url: string | null;
  };
  semester: {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
  };
  classroom: StudentClassroom;
  assignments: Array<{
    id: string;
    title: string;
    description: string | null;
    full_score: number;
    due_at: string | null;
    category: 'assignment' | 'quiz' | 'midterm' | 'final' | 'other';
    created_at: string;
    score: number | null;
    feedback: string | null;
    status: SubmissionStatus;
    updated_at: string | null;
    is_interactive_quiz: boolean;
    attachments: Array<{
      id: string;
      file_name: string;
      file_url: string;
      mime_type: string;
      file_size: number;
      created_at: string;
    }>;
  }>;
};

export type StudentAssignmentItem = StudentSubject['assignments'][number] & {
  subject: StudentSubject['subject'];
};

export type StudentRankingRow = {
  rank: number;
  student: StudentPerson;
  student_number: string | null;
  score: number;
  full_score: number;
  percentage: number;
  is_current_student: boolean;
};

export type StudentDashboardEnrollment = {
  id: string;
  student_number: string | null;
  classroom: StudentClassroom;
};

export type StudentDashboardBase = {
  generated_at: string;
  student: StudentPerson;
  enrollments: StudentDashboardEnrollment[];
};

export type StudentClassMember = {
  student: StudentPerson;
  student_number: string | null;
  is_current_student: boolean;
};

export type StudentAnnouncement = {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  priority: 'normal' | 'important' | 'urgent';
  announcement_type: 'general' | 'holiday' | 'exam';
  published_at: string;
  expires_at: string | null;
  event_start: string | null;
  event_end: string | null;
};

export type StudentHomeDashboard = StudentDashboardBase & {
  class_members: StudentClassMember[];
  homeroom_teachers: StudentPerson[];
  ranking: StudentRankingRow[];
  subject_rankings: Array<{
    id: string;
    subject: StudentSubject['subject'];
    semester: StudentSubject['semester'];
    ranking: StudentRankingRow[];
  }>;
  announcements: StudentAnnouncement[];
};

export type StudentClassroomDashboard = StudentDashboardBase & {
  class_members: StudentClassMember[];
  homeroom_teachers: StudentPerson[];
};

export type StudentSubjectsDashboard = StudentDashboardBase & {
  subjects: StudentSubject[];
  schedules: Array<{
    id: string;
    teacher_assignment_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    location_name: string | null;
    schedule_period: { period_number: number | null; name: string } | null;
    subject: StudentSubject['subject'];
    classroom: StudentClassroom;
    teacher: StudentPerson;
  }>;
};

export type StudentAssignmentsDashboard = StudentDashboardBase & {
  subjects: StudentSubject[];
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load student dashboard');

  return json;
}

export function getStudentHomeDashboard() {
  return fetchJson<StudentHomeDashboard>('/api/student/dashboard/home');
}

export function getStudentClassroomDashboard() {
  return fetchJson<StudentClassroomDashboard>('/api/student/dashboard/classroom');
}

export function getStudentSubjectsDashboard() {
  return fetchJson<StudentSubjectsDashboard>('/api/student/dashboard/subjects');
}

export function getStudentAssignmentsDashboard() {
  return fetchJson<StudentAssignmentsDashboard>('/api/student/dashboard/assignments');
}
