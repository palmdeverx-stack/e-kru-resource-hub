import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  const caller = requireRole(request, ['teacher']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('teaching_schedules')
    .select(
      `id, day_of_week, start_time, end_time, location_name,
       schedule_period:schedule_periods(period_number, name),
       teacher_assignment:teacher_assignments!inner(
         id, teacher_id,
         subject:subjects(name, code),
         classroom:classrooms(name, academic_years(year)),
         semester:semesters(name)
       )`
    )
    .eq('teacher_assignment.teacher_id', caller.sub)
    .order('day_of_week')
    .order('start_time');

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ schedules: data });
}
