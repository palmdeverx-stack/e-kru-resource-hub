import 'server-only';

import { supabaseAdmin } from './supabase-admin';

// ----------------------------------------------------------------------

const GRADABLE_STATUSES = ['submitted', 'late', 'pending_review'];

function bangkokDayOfWeek() {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date());

  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday) + 1;
}

export async function getTeacherDashboardSummaryData(teacherId: string, schoolId: string | null) {
  const [teacherResult, schoolResult, teachingResult] = await Promise.all([
    supabaseAdmin
      .from('app_users')
      .select('id, username, first_name, last_name')
      .eq('id', teacherId)
      .eq('role', 'teacher')
      .maybeSingle(),
    schoolId
      ? supabaseAdmin
          .from('schools')
          .select('id, name, code, logo_url')
          .eq('id', schoolId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseAdmin
      .from('teacher_assignments')
      .select(
        `id, classroom_id,
         subject:subjects(id, code, name, image_url),
         classroom:classrooms(id, name, grade_level, academic_year:academic_years(year)),
         semester:semesters(id, name, is_active, start_date, end_date)`
      )
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false }),
  ]);

  const firstError = teacherResult.error ?? schoolResult.error ?? teachingResult.error;
  if (firstError) throw new Error(firstError.message);
  if (!teacherResult.data) return null;

  const teachingRows = teachingResult.data ?? [];
  const teachingIds = teachingRows.map((row) => row.id);
  const classroomIds = Array.from(
    new Set(
      teachingRows
        .map((row) => (row.classroom as unknown as { id: string } | null)?.id)
        .filter(Boolean) as string[]
    )
  );

  const [enrollmentsResult, schedulesResult, assignmentIdsResult] = await Promise.all([
    classroomIds.length
      ? supabaseAdmin.from('enrollments').select('student_id').in('classroom_id', classroomIds)
      : Promise.resolve({ data: [], error: null }),
    teachingIds.length
      ? supabaseAdmin
          .from('teaching_schedules')
          .select(`id, teacher_assignment_id, day_of_week, start_time, end_time`)
          .in('teacher_assignment_id', teachingIds)
          .eq('day_of_week', bangkokDayOfWeek())
          .order('start_time')
      : Promise.resolve({ data: [], error: null }),
    teachingIds.length
      ? supabaseAdmin.from('assignments').select('id').in('teacher_assignment_id', teachingIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const relatedError =
    enrollmentsResult.error ?? schedulesResult.error ?? assignmentIdsResult.error;
  if (relatedError) throw new Error(relatedError.message);

  const assignmentIds = (assignmentIdsResult.data ?? []).map((row) => row.id);
  const { count: waitingToGradeCount, error: waitingError } = assignmentIds.length
    ? await supabaseAdmin
        .from('scores')
        .select('id', { count: 'exact', head: true })
        .in('assignment_id', assignmentIds)
        .in('status', GRADABLE_STATUSES)
        .is('score', null)
    : { count: 0, error: null };

  if (waitingError) throw new Error(waitingError.message);

  const teachingById = new Map(teachingRows.map((row) => [row.id, row]));
  const todaySchedules = (schedulesResult.data ?? []).map((schedule) => {
    const teaching = teachingById.get(schedule.teacher_assignment_id);
    return {
      ...schedule,
      subject: teaching?.subject ?? null,
      classroom: teaching?.classroom ?? null,
      semester: teaching?.semester ?? null,
    };
  });

  return {
    teacher: teacherResult.data,
    school: schoolResult.data,
    summary: {
      teaching_assignments: teachingRows.length,
      subjects: new Set(
        teachingRows
          .map((row) => (row.subject as unknown as { id: string } | null)?.id)
          .filter(Boolean)
      ).size,
      classrooms: classroomIds.length,
      students: new Set((enrollmentsResult.data ?? []).map((row) => row.student_id)).size,
      assignments: assignmentIds.length,
      waiting_to_grade: waitingToGradeCount ?? 0,
    },
    today_schedules: todaySchedules,
  };
}
