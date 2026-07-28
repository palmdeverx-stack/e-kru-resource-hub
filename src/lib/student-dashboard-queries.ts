import 'server-only';

import { today, fIsBetween } from 'src/utils/format-time';

import { supabaseAdmin } from './supabase-admin';

// ----------------------------------------------------------------------

export type StudentPerson = {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export type StudentAcademicYear = {
  id: string;
  year: string;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
};

export type StudentClassroom = {
  id: string;
  name: string;
  grade_level: string | null;
  academic_year: StudentAcademicYear | null;
};

export type StudentEnrollment = {
  id: string;
  student_number: string | null;
  classroom: StudentClassroom;
};

export function fetchStudent(studentId: string) {
  return supabaseAdmin
    .from('app_users')
    .select('id, username, first_name, last_name, avatar_url')
    .eq('id', studentId)
    .maybeSingle();
}

export function fetchEnrollments(studentId: string) {
  return supabaseAdmin
    .from('enrollments')
    .select(
      `id, student_number, classroom_id,
       classroom:classrooms(id, name, grade_level, academic_year:academic_years(id, year, is_active, start_date, end_date))`
    )
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
}

export function toEnrollments(
  rows: Array<{ id: string; student_number: string | null; classroom: unknown }>
): StudentEnrollment[] {
  return rows.map((row) => ({
    id: row.id,
    student_number: row.student_number,
    classroom: row.classroom as unknown as StudentClassroom,
  }));
}

export function pickCurrentEnrollment(enrollments: StudentEnrollment[]) {
  return (
    enrollments.find((row) =>
      fIsBetween(
        today(),
        row.classroom?.academic_year?.start_date,
        row.classroom?.academic_year?.end_date
      )
    ) ?? enrollments[0]
  );
}

export function fetchAnnouncements(schoolId: string) {
  return supabaseAdmin
    .from('school_announcements')
    .select(
      `id, title, content, image_url, priority, announcement_type, published_at, expires_at,
       event_start, event_end, targets:announcement_classrooms(classroom_id)`
    )
    .eq('school_id', schoolId)
    .eq('is_published', true)
    .lte('published_at', new Date().toISOString())
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('published_at', { ascending: false })
    .limit(10);
}

export function filterVisibleAnnouncements<T extends { targets: unknown }>(
  announcements: T[],
  currentClassroomId: string | undefined
) {
  return announcements.filter((announcement) => {
    const targets = announcement.targets as unknown as Array<{ classroom_id: string }>;
    return !targets.length || targets.some((target) => target.classroom_id === currentClassroomId);
  });
}

export function fetchTeachingRows(classroomIds: string[]) {
  return supabaseAdmin
    .from('teacher_assignments')
    .select(
      `id, classroom_id,
       teacher:app_users!teacher_assignments_teacher_id_fkey(id, username, first_name, last_name, avatar_url),
       subject:subjects(id, code, name, credits, description, image_url),
       semester:semesters(id, name, start_date, end_date, is_active),
       classroom:classrooms(id, name, grade_level, academic_year:academic_years(id, year, is_active))`
    )
    .in('classroom_id', classroomIds)
    .order('created_at');
}

export function fetchAssignments(teachingIds: string[]) {
  return supabaseAdmin
    .from('assignments')
    .select(
      `id, teacher_assignment_id, title, description, full_score, due_at, category, created_at,
       attachments:assignment_attachments(id, file_name, file_url, mime_type, file_size, created_at)`
    )
    .in('teacher_assignment_id', teachingIds)
    .order('created_at', { ascending: false });
}

export function fetchAssignmentsForRanking(teachingIds: string[]) {
  return supabaseAdmin
    .from('assignments')
    .select('id, teacher_assignment_id, full_score')
    .in('teacher_assignment_id', teachingIds);
}

export function fetchSchedules(teachingIds: string[]) {
  return supabaseAdmin
    .from('teaching_schedules')
    .select(
      'id, teacher_assignment_id, day_of_week, start_time, end_time, location_name, schedule_period:schedule_periods(period_number, name)'
    )
    .in('teacher_assignment_id', teachingIds)
    .order('day_of_week')
    .order('start_time');
}

export function fetchScores(studentId: string, assignmentIds: string[]) {
  return supabaseAdmin
    .from('scores')
    .select('assignment_id, score, feedback, status, updated_at')
    .eq('student_id', studentId)
    .in('assignment_id', assignmentIds);
}

export function fetchRankingScores(assignmentIds: string[]) {
  return supabaseAdmin
    .from('scores')
    .select('student_id, assignment_id, score')
    .in('assignment_id', assignmentIds);
}

export function fetchClassmates(classroomId: string) {
  return supabaseAdmin
    .from('enrollments')
    .select(
      `student_number,
       student:app_users!enrollments_student_id_fkey(id, username, first_name, last_name, avatar_url)`
    )
    .eq('classroom_id', classroomId)
    .order('student_number');
}

export function fetchHomeroomTeachers(classroomId: string) {
  return supabaseAdmin
    .from('classroom_homeroom_teachers')
    .select(
      'teacher:app_users!classroom_homeroom_teachers_teacher_id_fkey(id, username, first_name, last_name, avatar_url)'
    )
    .eq('classroom_id', classroomId);
}

export function toClassMembers(
  rows: Array<{ student_number: string | null; student: unknown }>,
  currentStudentId: string
) {
  return rows.map((row) => ({
    student: row.student as unknown as StudentPerson,
    student_number: row.student_number,
    is_current_student: (row.student as unknown as StudentPerson).id === currentStudentId,
  }));
}

export function buildRanking({
  assignments,
  scores,
  classmates,
  currentStudentId,
}: {
  assignments: Array<{ id: string; full_score: number | string }>;
  scores: Array<{ student_id: string; assignment_id: string; score: number | string }>;
  classmates: Array<{ student_number: string | null; student: StudentPerson }>;
  currentStudentId: string;
}) {
  const assignmentIdSet = new Set(assignments.map((assignment) => assignment.id));
  const totalFullScore = assignments.reduce(
    (total, assignment) => total + Number(assignment.full_score),
    0
  );
  const scoreByStudentId = new Map<string, number>();

  scores
    .filter((score) => assignmentIdSet.has(score.assignment_id))
    .forEach((score) => {
      scoreByStudentId.set(
        score.student_id,
        (scoreByStudentId.get(score.student_id) ?? 0) + Number(score.score)
      );
    });

  let previousScore: number | null = null;
  let previousRank = 0;

  return classmates
    .map((row) => {
      const classmate = row.student;
      const score = scoreByStudentId.get(classmate.id) ?? 0;

      return {
        student: classmate,
        student_number: row.student_number,
        score,
        full_score: totalFullScore,
        percentage: totalFullScore ? (score / totalFullScore) * 100 : 0,
        is_current_student: classmate.id === currentStudentId,
      };
    })
    .sort(
      (a, b) => b.percentage - a.percentage || a.student.username.localeCompare(b.student.username)
    )
    .map((row, index) => {
      if (previousScore === null || row.percentage !== previousScore) {
        previousRank = index + 1;
        previousScore = row.percentage;
      }

      return { ...row, rank: previousRank };
    });
}
