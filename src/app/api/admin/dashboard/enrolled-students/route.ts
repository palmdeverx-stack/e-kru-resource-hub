import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canViewViaPermission } from 'src/lib/department-permission-access';

// ----------------------------------------------------------------------

const PAGE_SIZE = 1000;

export async function GET(request: Request) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (
    !caller?.schoolId ||
    (caller.role === 'teacher' && !(await canViewViaPermission(caller, 'dashboard.view')))
  ) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const enrollments: unknown[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('enrollments')
      .select(
        `id, student_number, created_at,
         student:app_users!inner(
           id, username, email, student_code, national_id, name_prefix,
           first_name, last_name, first_name_en, last_name_en, nickname,
           gender, birth_date, nationality, ethnicity, religion,
           student_status, is_active
         ),
         classroom:classrooms!inner(
           id, name, name_en, grade_level, grade_level_en, school_id,
           academic_year:academic_years(id, year)
         )`
      )
      .eq('student.school_id', caller.schoolId)
      .eq('student.role', 'student')
      .eq('classroom.school_id', caller.schoolId)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const page = data ?? [];
    enrollments.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return NextResponse.json({ enrollments });
}
