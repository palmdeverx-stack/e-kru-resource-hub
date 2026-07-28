import 'server-only';

import { supabaseAdmin } from './supabase-admin';

// ----------------------------------------------------------------------

export async function loadOwnedAttendanceScanSession(
  sessionId: string,
  teacherId: string,
  schoolId: string
) {
  const { data } = await supabaseAdmin
    .from('attendance_scan_sessions')
    .select(
      `id, school_id, teacher_id, session_type, classroom_id, teacher_assignment_id,
       period_label, session_date, opened_at, late_after, closes_at, status,
       classroom:classrooms!inner(id, name, school_id, academic_years(year)),
       teacher_assignment:teacher_assignments(
         id, subject:subjects(id, code, name), semester:semesters(id, name)
       )`
    )
    .eq('id', sessionId)
    .eq('teacher_id', teacherId)
    .eq('school_id', schoolId)
    .eq('classroom.school_id', schoolId)
    .maybeSingle();

  return data;
}
