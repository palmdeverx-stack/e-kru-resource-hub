import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canApproveSchedule, canManageClassroomSchedule } from 'src/lib/schedule-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller?.schoolId) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const semesterId = searchParams.get('semesterId');
  if (!semesterId) return NextResponse.json({ message: 'กรุณาเลือกภาคเรียน' }, { status: 400 });

  const { data: classroom } = await supabaseAdmin
    .from('classrooms')
    .select(
      'id, name, grade_level, school_id, homeroom_teachers:classroom_homeroom_teachers(teacher:app_users(id, first_name, last_name))'
    )
    .eq('id', id)
    .maybeSingle();
  if (!classroom) return NextResponse.json({ message: 'ไม่พบห้องเรียนนี้' }, { status: 404 });

  // A director can review the schedule (read-only) even without schedule.manage.
  const canView =
    (await canManageClassroomSchedule(caller, classroom.school_id)) ||
    (classroom.school_id === caller.schoolId && (await canApproveSchedule(caller)));
  if (!canView) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('schedule_mode')
    .eq('id', classroom.school_id)
    .maybeSingle();

  const { data: semester } = await supabaseAdmin
    .from('semesters')
    .select('id, name, academic_year:academic_years(year)')
    .eq('id', semesterId)
    .maybeSingle();

  const { data: periods, error: periodsError } = await supabaseAdmin
    .from('schedule_periods')
    .select('id, semester_id, period_number, name, start_time, end_time, is_break')
    .eq('school_id', caller.schoolId)
    .eq('semester_id', semesterId)
    .order('start_time');
  if (periodsError) {
    return NextResponse.json({ message: periodsError.message }, { status: 500 });
  }

  const { data: assignments, error: assignmentsError } = await supabaseAdmin
    .from('teacher_assignments')
    .select(
      'id, subject:subjects(id, name, code), teacher:app_users!teacher_assignments_teacher_id_fkey(id, first_name, last_name)'
    )
    .eq('classroom_id', id)
    .eq('semester_id', semesterId);

  if (assignmentsError)
    return NextResponse.json({ message: assignmentsError.message }, { status: 500 });

  const assignmentIds = (assignments ?? []).map((assignment) => assignment.id);

  const { data: schedules, error: schedulesError } = assignmentIds.length
    ? await supabaseAdmin
        .from('teaching_schedules')
        .select(
          'id, day_of_week, start_time, end_time, location_name, schedule_period_id, teacher_assignment_id'
        )
        .in('teacher_assignment_id', assignmentIds)
    : { data: [], error: null };

  if (schedulesError)
    return NextResponse.json({ message: schedulesError.message }, { status: 500 });

  return NextResponse.json({
    classroom,
    semester,
    assignments,
    schedules,
    periods,
    scheduleMode: school?.schedule_mode ?? 'hour',
  });
}
