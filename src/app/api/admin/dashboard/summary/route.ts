import { NextResponse } from 'next/server';

import { today, fIsBetween } from 'src/utils/format-time';

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
  const [
    schoolResult,
    studentsResult,
    teachersResult,
    classroomsResult,
    subjectsResult,
    enrollmentsResult,
    academicYearResult,
  ] = await Promise.all([
    supabaseAdmin.from('schools').select('id, name, code, logo_url').eq('id', schoolId).single(),
    supabaseAdmin
      .from('app_users')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('role', 'student'),
    supabaseAdmin
      .from('app_users')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('role', 'teacher'),
    supabaseAdmin
      .from('classrooms')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId),
    supabaseAdmin
      .from('subjects')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId),
    supabaseAdmin
      .from('enrollments')
      .select('id, classrooms!inner(school_id)', { count: 'exact', head: true })
      .eq('classrooms.school_id', schoolId),
    supabaseAdmin
      .from('academic_years')
      .select(
        'id, year, start_date, end_date, is_active, semesters(id, name, is_active, start_date, end_date)'
      )
      .eq('school_id', schoolId)
      .order('year', { ascending: false }),
  ]);

  const firstError = [
    schoolResult.error,
    studentsResult.error,
    teachersResult.error,
    classroomsResult.error,
    subjectsResult.error,
    enrollmentsResult.error,
    academicYearResult.error,
  ].find(Boolean);

  if (firstError) {
    return NextResponse.json({ message: firstError.message }, { status: 500 });
  }

  const academicYears = academicYearResult.data ?? [];
  const currentAcademicYear =
    academicYears.find((year) => fIsBetween(today(), year.start_date, year.end_date)) ??
    academicYears[0] ??
    null;

  return NextResponse.json({
    school: schoolResult.data,
    counts: {
      students: studentsResult.count ?? 0,
      teachers: teachersResult.count ?? 0,
      classrooms: classroomsResult.count ?? 0,
      subjects: subjectsResult.count ?? 0,
      enrollments: enrollmentsResult.count ?? 0,
    },
    academicYear: currentAcademicYear,
  });
}
