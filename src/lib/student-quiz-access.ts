import 'server-only';

import type { AppTokenPayload } from './auth-token';

import { supabaseAdmin } from './supabase-admin';

// ----------------------------------------------------------------------

export async function loadStudentQuizAccess(caller: AppTokenPayload, assignmentId: string) {
  const [{ data: student }, { data: assignment }] = await Promise.all([
    supabaseAdmin
      .from('app_users')
      .select('id, school_id, is_active, student_status')
      .eq('id', caller.sub)
      .eq('role', 'student')
      .maybeSingle(),
    supabaseAdmin
      .from('assignments')
      .select('id, teacher_assignment_id, title, description, full_score, due_at, category')
      .eq('id', assignmentId)
      .maybeSingle(),
  ]);

  if (
    !student ||
    !student.is_active ||
    (student.student_status && student.student_status !== 'studying') ||
    !assignment ||
    assignment.category !== 'quiz'
  ) {
    return null;
  }

  const { data: teaching } = await supabaseAdmin
    .from('teacher_assignments')
    .select(
      `id, classroom_id, teacher_id,
       subject:subjects(id, code, name),
       classroom:classrooms(id, name, school_id)`
    )
    .eq('id', assignment.teacher_assignment_id)
    .maybeSingle();

  const classroom = teaching?.classroom as unknown as {
    id: string;
    name: string;
    school_id: string;
  } | null;

  if (
    !teaching ||
    !classroom ||
    !caller.schoolId ||
    student.school_id !== caller.schoolId ||
    classroom.school_id !== caller.schoolId
  ) {
    return null;
  }

  const { data: enrollment } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('classroom_id', teaching.classroom_id)
    .eq('student_id', caller.sub)
    .maybeSingle();

  if (!enrollment) return null;

  return {
    assignment,
    teaching,
    classroom,
    subject: teaching.subject as unknown as { id: string; code: string | null; name: string },
  };
}
