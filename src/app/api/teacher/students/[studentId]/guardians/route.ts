import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { GUARDIAN_PUBLIC_FIELDS } from 'src/lib/student-guardian';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ studentId: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { studentId } = await params;

  const { data: student } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('id', studentId)
    .eq('school_id', caller.schoolId)
    .eq('role', 'student')
    .maybeSingle();

  if (!student) {
    return NextResponse.json({ message: 'ไม่พบนักเรียนในโรงเรียนของคุณ' }, { status: 404 });
  }

  if (caller.role === 'teacher') {
    const { data: enrollments } = await supabaseAdmin
      .from('enrollments')
      .select('classroom_id')
      .eq('student_id', studentId);
    const classroomIds = (enrollments ?? []).map((row) => row.classroom_id);
    const { data: ownedClassroom } = classroomIds.length
      ? await supabaseAdmin
          .from('classroom_homeroom_teachers')
          .select('classroom:classrooms!inner(id, school_id)')
          .eq('teacher_id', caller.sub)
          .eq('classroom.school_id', caller.schoolId)
          .in('classroom_id', classroomIds)
          .limit(1)
          .maybeSingle()
      : { data: null };

    if (!ownedClassroom) {
      return NextResponse.json(
        { message: 'คุณไม่ใช่ครูประจำชั้นของนักเรียนคนนี้' },
        { status: 403 }
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from('student_guardians')
    .select(GUARDIAN_PUBLIC_FIELDS)
    .eq('student_id', studentId)
    .eq('school_id', caller.schoolId)
    .order('is_primary', { ascending: false })
    .order('created_at');

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ guardians: data });
}
