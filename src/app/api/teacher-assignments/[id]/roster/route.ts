import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import {
  loadTeacherAssignment,
  canAccessTeacherAssignment,
} from 'src/lib/teacher-assignment-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const teacherAssignment = await loadTeacherAssignment(id);

  if (!canAccessTeacherAssignment(caller, teacherAssignment)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('enrollments')
    .select(
      'id, student_number, student:app_users(id, username, first_name, last_name, avatar_url)'
    )
    .eq('classroom_id', teacherAssignment!.classroom_id)
    .order('student_number');

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    roster: data,
    subjectId: teacherAssignment!.subject_id,
    classroomName: (teacherAssignment as any)?.classrooms?.name ?? null,
    subjectName: (teacherAssignment as any)?.subjects?.name ?? null,
    subjectCode: (teacherAssignment as any)?.subjects?.code ?? null,
    credits: Number((teacherAssignment as any)?.subjects?.credits ?? 0),
    subjectImageUrl: (teacherAssignment as any)?.subjects?.image_url ?? null,
    academicYear: (teacherAssignment as any)?.classrooms?.academic_years?.year ?? null,
    semesterName: (teacherAssignment as any)?.semesters?.name ?? null,
    semesterIsActive: Boolean((teacherAssignment as any)?.semesters?.is_active),
    teacher: (teacherAssignment as any)?.teacher ?? null,
  });
}
