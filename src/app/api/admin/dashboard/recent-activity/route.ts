import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canViewViaPermission } from 'src/lib/department-permission-access';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (
    !caller?.schoolId ||
    (caller.role === 'teacher' && !(await canViewViaPermission(caller, 'dashboard.view')))
  ) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const schoolId = caller.schoolId;
  const [recentAssignmentsResult, recentEnrollmentsResult] = await Promise.all([
    supabaseAdmin
      .from('teacher_assignments')
      .select(
        `id, created_at,
         teacher:app_users!teacher_assignments_teacher_id_fkey(first_name, last_name, username),
         subject:subjects(name, code),
         classroom:classrooms!inner(name, school_id),
         semester:semesters(name)`
      )
      .eq('classroom.school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('enrollments')
      .select(
        `id, created_at, student_number,
         student:app_users!enrollments_student_id_fkey(first_name, last_name, username),
         classroom:classrooms!inner(name, school_id)`
      )
      .eq('classroom.school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const firstError = recentAssignmentsResult.error ?? recentEnrollmentsResult.error;
  if (firstError) {
    return NextResponse.json({ message: firstError.message }, { status: 500 });
  }

  return NextResponse.json({
    recentAssignments: recentAssignmentsResult.data ?? [],
    recentEnrollments: recentEnrollmentsResult.data ?? [],
  });
}
