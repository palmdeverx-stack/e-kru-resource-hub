import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canManageViaPermission } from 'src/lib/department-permission-access';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const academicYearId = searchParams.get('academicYearId');

  let query = supabaseAdmin
    .from('classrooms')
    .select(
      'id, name, name_en, grade_level, grade_level_en, academic_year_id, academic_years(year), created_at'
    )
    .eq('school_id', caller.schoolId)
    .order('name');

  if (academicYearId) query = query.eq('academic_year_id', academicYearId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const classroomIds = data.map((classroom) => classroom.id);
  const { data: homeroomRows, error: homeroomError } = classroomIds.length
    ? await supabaseAdmin
        .from('classroom_homeroom_teachers')
        .select(
          'classroom_id, teacher:app_users!classroom_homeroom_teachers_teacher_id_fkey(id, username, first_name, last_name)'
        )
        .in('classroom_id', classroomIds)
    : { data: [], error: null };

  if (homeroomError) {
    return NextResponse.json({ message: homeroomError.message }, { status: 500 });
  }

  const classrooms = data.map((classroom) => ({
    ...classroom,
    homeroom_teachers: homeroomRows
      .filter((row) => row.classroom_id === classroom.id)
      .map((row) => row.teacher),
  }));

  return NextResponse.json({ classrooms });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const {
    name,
    nameEn,
    gradeLevel,
    gradeLevelEn,
    academicYearId,
    teacherIds,
    subjectId,
    semesterId,
  } = await request.json();

  const isAdminLike = await canManageViaPermission(caller, 'classrooms.manage');

  const requestedTeacherIds = isAdminLike
    ? Array.from(new Set(Array.isArray(teacherIds) ? teacherIds.filter(Boolean) : []))
    : [caller.sub];

  if (!name || !academicYearId || requestedTeacherIds.length === 0) {
    return NextResponse.json(
      { message: 'กรุณากรอกข้อมูลให้ครบและเลือกครูประจำชั้นอย่างน้อย 1 คน' },
      { status: 400 }
    );
  }

  if (!isAdminLike && (!subjectId || !semesterId)) {
    return NextResponse.json(
      { message: 'กรุณาเลือกวิชาและภาคเรียน เพื่อผูกห้องนี้เข้ากับคุณ' },
      { status: 400 }
    );
  }

  const { data: year } = await supabaseAdmin
    .from('academic_years')
    .select('id')
    .eq('id', academicYearId)
    .eq('school_id', caller.schoolId)
    .maybeSingle();

  if (!year) {
    return NextResponse.json({ message: 'ไม่พบปีการศึกษานี้' }, { status: 404 });
  }

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

  const { data: classroom, error } = await supabaseAdmin
    .from('classrooms')
    .insert({
      name: String(name).trim(),
      name_en: typeof nameEn === 'string' && nameEn.trim() ? nameEn.trim() : null,
      grade_level: typeof gradeLevel === 'string' && gradeLevel.trim() ? gradeLevel.trim() : null,
      grade_level_en:
        typeof gradeLevelEn === 'string' && gradeLevelEn.trim() ? gradeLevelEn.trim() : null,
      academic_year_id: academicYearId,
      school_id: caller.schoolId,
    })
    .select('id, name, name_en, grade_level, grade_level_en, academic_year_id, created_at')
    .single();

  if (error || !classroom) {
    return NextResponse.json(
      { message: error?.message ?? 'Failed to create classroom' },
      { status: 500 }
    );
  }

  const { error: homeroomError } = await supabaseAdmin.from('classroom_homeroom_teachers').insert(
    requestedTeacherIds.map((teacherId) => ({
      classroom_id: classroom.id,
      teacher_id: teacherId,
    }))
  );

  if (homeroomError) {
    await supabaseAdmin.from('classrooms').delete().eq('id', classroom.id);
    return NextResponse.json({ message: homeroomError.message }, { status: 500 });
  }

  if (!isAdminLike) {
    const { data: subject } = await supabaseAdmin
      .from('subjects')
      .select('id')
      .eq('id', subjectId)
      .eq('semester_id', semesterId)
      .eq('school_id', caller.schoolId)
      .maybeSingle();

    const { data: semester } = await supabaseAdmin
      .from('semesters')
      .select('id, academic_years!inner(school_id)')
      .eq('id', semesterId)
      .eq('academic_years.school_id', caller.schoolId)
      .maybeSingle();

    if (!subject || !semester) {
      return NextResponse.json(
        { message: 'ไม่พบรายวิชาหรือภาคเรียนนี้ในโรงเรียนของคุณ' },
        { status: 404 }
      );
    }

    const { error: assignmentError } = await supabaseAdmin.from('teacher_assignments').insert({
      teacher_id: caller.sub,
      subject_id: subjectId,
      classroom_id: classroom.id,
      semester_id: semesterId,
    });

    if (assignmentError) {
      return NextResponse.json({ message: assignmentError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ classroom }, { status: 201 });
}
