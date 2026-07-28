import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller || caller.schoolId !== (await params).id) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id: schoolId } = await params;

  const { data: teachers, error } = await supabaseAdmin
    .from('app_users')
    .select('id, first_name, last_name, avatar_url, position_title, academic_rank')
    .eq('school_id', schoolId)
    .eq('role', 'teacher')
    .order('first_name');

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const teacherIds = teachers.map((teacher) => teacher.id);

  const [{ data: memberships, error: membershipError }, { data: homerooms, error: homeroomError }] =
    teacherIds.length
      ? await Promise.all([
          supabaseAdmin
            .from('department_members')
            .select('teacher_id, role_in_department, department:departments(name)')
            .in('teacher_id', teacherIds),
          supabaseAdmin
            .from('classroom_homeroom_teachers')
            .select('teacher_id, classroom:classrooms(name, grade_level)')
            .in('teacher_id', teacherIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

  if (membershipError) return NextResponse.json({ message: membershipError.message }, { status: 500 });
  if (homeroomError) return NextResponse.json({ message: homeroomError.message }, { status: 500 });

  const membershipByTeacher = new Map(
    (memberships ?? []).map((row) => [
      row.teacher_id,
      {
        department_name: (row.department as unknown as { name: string } | null)?.name ?? null,
        role_in_department: row.role_in_department as 'head' | 'member',
      },
    ])
  );

  const homeroomsByTeacher = new Map<string, { name: string; grade_level: string | null }[]>();
  for (const row of homerooms ?? []) {
    const classroom = row.classroom as unknown as { name: string; grade_level: string | null };
    const list = homeroomsByTeacher.get(row.teacher_id) ?? [];
    list.push(classroom);
    homeroomsByTeacher.set(row.teacher_id, list);
  }

  const roster = teachers.map((teacher) => ({
    ...teacher,
    department_name: membershipByTeacher.get(teacher.id)?.department_name ?? null,
    role_in_department: membershipByTeacher.get(teacher.id)?.role_in_department ?? null,
    homeroom_classrooms: homeroomsByTeacher.get(teacher.id) ?? [],
  }));

  return NextResponse.json({ teachers: roster });
}
