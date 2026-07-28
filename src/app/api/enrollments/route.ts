import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classroomId = searchParams.get('classroomId');
  const studentId = searchParams.get('studentId');
  const academicYearId = searchParams.get('academicYearId');

  let query = supabaseAdmin
    .from('enrollments')
    .select(
      `id, student_id, classroom_id, student_number, created_at,
       student:app_users(id, username, first_name, last_name, student_status, is_active),
       classroom:classrooms!inner(id, name, school_id, academic_year_id, academic_years(year))`
    )
    .eq('classroom.school_id', caller.schoolId)
    .order(classroomId ? 'student_number' : 'created_at', {
      ascending: !!classroomId,
      nullsFirst: false,
    });

  if (classroomId) query = query.eq('classroom_id', classroomId);
  if (studentId) query = query.eq('student_id', studentId);
  if (academicYearId) query = query.eq('classroom.academic_year_id', academicYearId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const enrollments = data ?? [];

  return NextResponse.json({
    enrollments,
    summary: {
      enrollments: enrollments.length,
      students: new Set(enrollments.map((row) => row.student_id)).size,
      classrooms: new Set(enrollments.map((row) => row.classroom_id)).size,
    },
    filters: {
      classroomId,
      studentId,
      academicYearId,
    },
  });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const {
    studentId,
    studentIds: requestedStudentIds,
    classroomId,
    studentNumber,
  } = await request.json();
  const studentIds = Array.from(
    new Set(
      (Array.isArray(requestedStudentIds) ? requestedStudentIds : [studentId]).filter(
        (id): id is string => typeof id === 'string' && !!id
      )
    )
  );

  if (!studentIds.length || !classroomId) {
    return NextResponse.json({ message: 'กรุณาเลือกนักเรียนและห้องเรียน' }, { status: 400 });
  }
  if (studentIds.length > 200) {
    return NextResponse.json({ message: 'เพิ่มนักเรียนได้สูงสุดครั้งละ 200 คน' }, { status: 400 });
  }

  const [{ data: students }, { data: classroom }] = await Promise.all([
    supabaseAdmin
      .from('app_users')
      .select('id, is_active, student_status')
      .in('id', studentIds)
      .eq('role', 'student')
      .eq('school_id', caller.schoolId)
      .eq('is_active', true)
      .eq('student_status', 'studying'),
    supabaseAdmin
      .from('classrooms')
      .select('id, academic_year_id')
      .eq('id', classroomId)
      .eq('school_id', caller.schoolId)
      .maybeSingle(),
  ]);

  if (students?.length !== studentIds.length || !classroom) {
    return NextResponse.json(
      {
        message: 'ไม่พบนักเรียนหรือห้องเรียน หรือมีนักเรียนที่สถานะไม่สามารถลงทะเบียนเรียนได้',
      },
      { status: 409 }
    );
  }

  const { data: existingEnrollments } = await supabaseAdmin
    .from('enrollments')
    .select('student_id')
    .in('student_id', studentIds)
    .eq('academic_year_id', classroom.academic_year_id);

  if (existingEnrollments?.length) {
    return NextResponse.json(
      {
        message: `มีนักเรียน ${existingEnrollments.length} คนที่มีห้องเรียนในปีการศึกษานี้แล้ว กรุณาเลือกใหม่`,
      },
      { status: 409 }
    );
  }

  const { data: enrollments, error } = await supabaseAdmin
    .from('enrollments')
    .insert(
      studentIds.map((id) => ({
        student_id: id,
        classroom_id: classroomId,
        student_number: studentIds.length === 1 ? studentNumber || null : null,
      }))
    )
    .select('id, student_id, classroom_id, student_number, created_at');

  if (error || !enrollments) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { message: 'มีนักเรียนบางคนอยู่ในห้องเรียนอื่นแล้วในปีการศึกษานี้' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: error?.message ?? 'Failed to create enrollments' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      enrollment: enrollments[0],
      enrollments,
      createdCount: enrollments.length,
    },
    { status: 201 }
  );
}
