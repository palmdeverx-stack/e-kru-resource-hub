import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canManageViaPermission } from 'src/lib/department-permission-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller || !(await canManageViaPermission(caller, 'classrooms.manage'))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { name, nameEn, gradeLevel, gradeLevelEn, academicYearId, teacherIds } =
    await request.json();
  const requestedTeacherIds = Array.from(
    new Set(Array.isArray(teacherIds) ? teacherIds.filter(Boolean) : [])
  ) as string[];

  if (!name || !academicYearId || requestedTeacherIds.length === 0) {
    return NextResponse.json(
      { message: 'กรุณากรอกข้อมูลให้ครบและเลือกครูประจำชั้นอย่างน้อย 1 คน' },
      { status: 400 }
    );
  }

  const { data: year } = await supabaseAdmin
    .from('academic_years')
    .select('id')
    .eq('id', academicYearId)
    .eq('school_id', caller.schoolId)
    .maybeSingle();

  if (!year) return NextResponse.json({ message: 'ไม่พบปีการศึกษานี้' }, { status: 404 });

  const { data: teachers } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .in('id', requestedTeacherIds)
    .eq('school_id', caller.schoolId)
    .eq('role', 'teacher');

  if (teachers?.length !== requestedTeacherIds.length) {
    return NextResponse.json(
      { message: 'พบครูประจำชั้นที่ไม่ถูกต้องหรือไม่ได้อยู่ในโรงเรียนนี้' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('classrooms')
    .update({
      name: String(name).trim(),
      name_en: typeof nameEn === 'string' && nameEn.trim() ? nameEn.trim() : null,
      grade_level: typeof gradeLevel === 'string' && gradeLevel.trim() ? gradeLevel.trim() : null,
      grade_level_en:
        typeof gradeLevelEn === 'string' && gradeLevelEn.trim() ? gradeLevelEn.trim() : null,
      academic_year_id: academicYearId,
    })
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .select('id, name, name_en, grade_level, grade_level_en, academic_year_id, created_at')
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'ไม่พบห้องเรียนนี้' }, { status: 404 });

  const { error: upsertError } = await supabaseAdmin.from('classroom_homeroom_teachers').upsert(
    requestedTeacherIds.map((teacherId) => ({ classroom_id: id, teacher_id: teacherId })),
    { onConflict: 'classroom_id,teacher_id' }
  );

  if (upsertError) return NextResponse.json({ message: upsertError.message }, { status: 500 });

  const retainedTeacherIds = `(${requestedTeacherIds.join(',')})`;
  const { error: removeError } = await supabaseAdmin
    .from('classroom_homeroom_teachers')
    .delete()
    .eq('classroom_id', id)
    .not('teacher_id', 'in', retainedTeacherIds);

  if (removeError) return NextResponse.json({ message: removeError.message }, { status: 500 });

  return NextResponse.json({
    classroom: {
      ...data,
      homeroom_teachers: teachers,
    },
  });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller || !(await canManageViaPermission(caller, 'classrooms.manage'))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('classrooms')
    .delete()
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'ไม่พบห้องเรียนนี้' }, { status: 404 });

  return NextResponse.json({ success: true });
}
