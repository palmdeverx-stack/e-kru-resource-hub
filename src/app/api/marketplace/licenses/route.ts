import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

export async function GET(request: Request) {
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'เฉพาะผู้ดูแลโรงเรียนเท่านั้น' }, { status: 403 });
  }

  const [
    { data: licenses, error },
    { data: teachers, error: teacherError },
    { data: invitedTeachers, error: invitedTeacherError },
  ] = await Promise.all([
    supabaseAdmin
      .from('marketplace_school_licenses')
      .select(
        '*, product:marketplace_products(id, title), assignments:marketplace_teacher_license_assignments(id, teacher_id, assigned_at, revoked_at)'
      )
      .eq('school_id', caller.schoolId)
      .order('expires_at', { ascending: false }),
    supabaseAdmin
      .from('app_users')
      .select('id, username, first_name, last_name, avatar_url')
      .eq('school_id', caller.schoolId)
      .eq('role', 'teacher')
      .eq('is_active', true)
      .order('first_name'),
    supabaseAdmin
      .from('marketplace_school_members')
      .select('marketplace_user:marketplace_users(id,username,first_name,last_name)')
      .eq('school_id', caller.schoolId)
      .eq('membership_role', 'teacher'),
  ]);
  if (error || teacherError || invitedTeacherError) {
    return NextResponse.json(
      {
        message:
          error?.message ??
          teacherError?.message ??
          invitedTeacherError?.message ??
          'โหลดข้อมูล License ไม่สำเร็จ',
      },
      { status: 500 }
    );
  }

  const teacherMap = new Map((teachers ?? []).map((teacher) => [teacher.id, teacher]));
  for (const row of invitedTeachers ?? []) {
    const teacher = Array.isArray(row.marketplace_user)
      ? row.marketplace_user[0]
      : row.marketplace_user;
    if (teacher) teacherMap.set(teacher.id, { ...teacher, avatar_url: null });
  }

  return NextResponse.json({
    licenses: (licenses ?? []).map((license) => ({
      ...license,
      assignments: (license.assignments ?? []).filter(
        (assignment: { revoked_at: string | null }) => !assignment.revoked_at
      ),
    })),
    teachers: [...teacherMap.values()],
  });
}
