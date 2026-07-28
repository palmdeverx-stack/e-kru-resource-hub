import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

async function getOwnedClassroom(classroomId: string, teacherId: string, schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from('classroom_homeroom_teachers')
    .select('classroom:classrooms!inner(id, academic_year_id, school_id)')
    .eq('classroom_id', classroomId)
    .eq('teacher_id', teacherId)
    .eq('classroom.school_id', schoolId)
    .maybeSingle();

  return { data: firstRelation(data?.classroom), error };
}

async function getOwnedEnrollment(enrollmentId: string, teacherId: string, schoolId: string) {
  const { data: enrollment } = await supabaseAdmin
    .from('enrollments')
    .select('id, classroom_id')
    .eq('id', enrollmentId)
    .maybeSingle();

  if (!enrollment) return null;

  const { data: ownership } = await getOwnedClassroom(enrollment.classroom_id, teacherId, schoolId);
  return ownership ? enrollment : null;
}

export async function GET(request: Request) {
  const caller = requireRole(request, ['teacher']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { data: homeroomRows, error: classroomError } = await supabaseAdmin
    .from('classroom_homeroom_teachers')
    .select(
      `classroom:classrooms!inner(
        id, name, grade_level, academic_year_id, school_id, academic_years(year)
      )`
    )
    .eq('teacher_id', caller.sub)
    .eq('classroom.school_id', caller.schoolId);

  if (classroomError) {
    return NextResponse.json({ message: classroomError.message }, { status: 500 });
  }

  const classrooms = (homeroomRows ?? []).flatMap((row) => {
    const classroom = firstRelation(row.classroom);
    if (!classroom) return [];

    return [
      {
        ...classroom,
        academic_years: firstRelation(classroom.academic_years),
      },
    ];
  });
  const classroomIds = classrooms.map((classroom) => classroom.id);

  const { data: enrollments, error: enrollmentError } = classroomIds.length
    ? await supabaseAdmin
        .from('enrollments')
        .select(
          `id, classroom_id, student_number, created_at,
           student:app_users!enrollments_student_id_fkey(
             id, username, email, first_name, last_name, avatar_url,
             student_code, nickname, student_status, is_active
           )`
        )
        .in('classroom_id', classroomIds)
        .order('student_number', { ascending: true, nullsFirst: false })
    : { data: [], error: null };

  if (enrollmentError) {
    return NextResponse.json({ message: enrollmentError.message }, { status: 500 });
  }

  return NextResponse.json({ classrooms, enrollments: enrollments ?? [] });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['teacher']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const classroomId = typeof body?.classroomId === 'string' ? body.classroomId : '';
  const studentIds = Array.from(
    new Set(
      (Array.isArray(body?.studentIds) ? body.studentIds : []).filter(
        (id: unknown): id is string => typeof id === 'string' && !!id
      )
    )
  );

  if (!classroomId || !studentIds.length) {
    return NextResponse.json(
      { message: 'กรุณาเลือกห้องเรียนและนักเรียนอย่างน้อย 1 คน' },
      { status: 400 }
    );
  }

  const { data: ownership } = await getOwnedClassroom(classroomId, caller.sub, caller.schoolId);
  const classroom = ownership;
  if (!classroom) {
    return NextResponse.json({ message: 'คุณไม่ใช่ครูประจำชั้นของห้องเรียนนี้' }, { status: 403 });
  }

  const { data: students } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .in('id', studentIds)
    .eq('school_id', caller.schoolId)
    .eq('role', 'student')
    .eq('is_active', true)
    .eq('student_status', 'studying');

  if (students?.length !== studentIds.length) {
    return NextResponse.json(
      { message: 'มีนักเรียนที่ไม่อยู่ในโรงเรียนหรือสถานะไม่สามารถลงทะเบียนได้' },
      { status: 409 }
    );
  }

  const { data: conflicts } = await supabaseAdmin
    .from('enrollments')
    .select('student_id')
    .in('student_id', studentIds)
    .eq('academic_year_id', classroom.academic_year_id);

  if (conflicts?.length) {
    return NextResponse.json(
      { message: `มีนักเรียน ${conflicts.length} คนที่มีห้องเรียนในปีการศึกษานี้แล้ว` },
      { status: 409 }
    );
  }

  const { data: enrollments, error } = await supabaseAdmin
    .from('enrollments')
    .insert(studentIds.map((studentId) => ({ student_id: studentId, classroom_id: classroomId })))
    .select('id, classroom_id, student_number, created_at');

  if (error) {
    return NextResponse.json(
      {
        message: error.code === '23505' ? 'มีนักเรียนบางคนอยู่ในห้องเรียนแล้ว' : error.message,
      },
      { status: error.code === '23505' ? 409 : 500 }
    );
  }

  return NextResponse.json({ enrollments }, { status: 201 });
}

export async function PATCH(request: Request) {
  const caller = requireRole(request, ['teacher']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const enrollmentId = typeof body?.enrollmentId === 'string' ? body.enrollmentId : '';
  const studentNumber =
    typeof body?.studentNumber === 'string' ? body.studentNumber.trim() || null : null;

  if (!enrollmentId || (studentNumber && !/^\d+$/.test(studentNumber))) {
    return NextResponse.json({ message: 'ข้อมูลเลขที่ไม่ถูกต้อง' }, { status: 400 });
  }

  const enrollment = await getOwnedEnrollment(enrollmentId, caller.sub, caller.schoolId);
  if (!enrollment) {
    return NextResponse.json(
      { message: 'ไม่พบการลงทะเบียนหรือคุณไม่ใช่ครูประจำชั้น' },
      { status: 404 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('enrollments')
    .update({ student_number: studentNumber })
    .eq('id', enrollmentId)
    .select('id, classroom_id, student_number, created_at')
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ enrollment: data });
}

export async function DELETE(request: Request) {
  const caller = requireRole(request, ['teacher']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const enrollmentId = new URL(request.url).searchParams.get('enrollmentId') ?? '';
  const enrollment = await getOwnedEnrollment(enrollmentId, caller.sub, caller.schoolId);
  if (!enrollment) {
    return NextResponse.json(
      { message: 'ไม่พบการลงทะเบียนหรือคุณไม่ใช่ครูประจำชั้น' },
      { status: 404 }
    );
  }

  const { error } = await supabaseAdmin.from('enrollments').delete().eq('id', enrollmentId);
  if (error) {
    return NextResponse.json({ message: 'ไม่สามารถนำนักเรียนออกจากชั้นได้' }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
