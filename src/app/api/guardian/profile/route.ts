import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { verifyGuardianPortalToken } from 'src/lib/guardian-portal-token';

// ----------------------------------------------------------------------

export async function GET() {
  const cookieStore = await cookies();
  const payload = verifyGuardianPortalToken(
    cookieStore.get('guardian_portal_session')?.value ?? '',
    'session'
  );
  if (!payload) {
    return NextResponse.json(
      { message: 'กรุณาเข้าสู่ระบบด้วยรหัสนักเรียนที่เชื่อมกับ LINE ผู้ปกครอง' },
      { status: 401 }
    );
  }

  const { data: guardians, error: guardianError } = await supabaseAdmin
    .from('student_guardians')
    .select('student_id, full_name, relationship')
    .eq('school_id', payload.schoolId)
    .eq('line_user_id', payload.lineUserId)
    .eq('student_id', payload.studentId!);
  if (guardianError) {
    return NextResponse.json({ message: guardianError.message }, { status: 500 });
  }

  const studentIds = Array.from(new Set((guardians ?? []).map((guardian) => guardian.student_id)));
  if (!studentIds.length) {
    return NextResponse.json(
      { message: 'ไม่พบนักเรียนที่เชื่อมกับบัญชี LINE นี้' },
      { status: 404 }
    );
  }

  const [{ data: school, error: schoolError }, { data: students, error: studentError }] =
    await Promise.all([
      supabaseAdmin
        .from('schools')
        .select('id, name, code, logo_url')
        .eq('id', payload.schoolId)
        .maybeSingle(),
      supabaseAdmin
        .from('app_users')
        .select(
          `id, name_prefix, first_name, last_name, first_name_en, last_name_en, nickname,
           avatar_url, student_status, student_code, birth_date, gender, nationality, religion`
        )
        .eq('school_id', payload.schoolId)
        .eq('role', 'student')
        .eq('is_active', true)
        .eq('student_status', 'studying')
        .in('id', studentIds),
    ]);
  if (schoolError || studentError) {
    return NextResponse.json(
      { message: schoolError?.message ?? studentError?.message },
      { status: 500 }
    );
  }

  const { data: enrollments, error: enrollmentError } = await supabaseAdmin
    .from('enrollments')
    .select(
      `student_id, student_number, created_at,
       classroom:classrooms!inner(id, name, grade_level, school_id,
         academic_year:academic_years(year, is_active))`
    )
    .in('student_id', studentIds)
    .eq('classroom.school_id', payload.schoolId)
    .order('created_at', { ascending: false });
  if (enrollmentError) {
    return NextResponse.json({ message: enrollmentError.message }, { status: 500 });
  }

  const historyStartDate = new Date();
  historyStartDate.setFullYear(historyStartDate.getFullYear() - 1);
  const historyStart = historyStartDate.toISOString().slice(0, 10);
  const [
    { data: classAttendance, error: classAttendanceError },
    { data: homeroomAttendance, error: homeroomAttendanceError },
  ] = await Promise.all([
    supabaseAdmin
      .from('attendance')
      .select(
        `id, student_id, session_date, period_key, status, note,
         teacher_assignment:teacher_assignments!inner(
           subject:subjects(name, code),
           classroom:classrooms!inner(name, school_id)
         )`
      )
      .in('student_id', studentIds)
      .eq('teacher_assignment.classroom.school_id', payload.schoolId)
      .gte('session_date', historyStart)
      .order('session_date', { ascending: false })
      .limit(500),
    supabaseAdmin
      .from('homeroom_assembly_attendance')
      .select(
        `id, student_id, attendance_date, period, status, note,
         classroom:classrooms!inner(name, school_id)`
      )
      .in('student_id', studentIds)
      .eq('classroom.school_id', payload.schoolId)
      .gte('attendance_date', historyStart)
      .order('attendance_date', { ascending: false })
      .limit(500),
  ]);
  if (classAttendanceError || homeroomAttendanceError) {
    return NextResponse.json(
      { message: classAttendanceError?.message ?? homeroomAttendanceError?.message },
      { status: 500 }
    );
  }

  const enrollmentByStudent = new Map<string, (typeof enrollments)[number]>();
  for (const enrollment of enrollments ?? []) {
    if (!enrollmentByStudent.has(enrollment.student_id)) {
      enrollmentByStudent.set(enrollment.student_id, enrollment);
    }
  }
  const guardianByStudent = new Map(
    (guardians ?? []).map((guardian) => [
      guardian.student_id,
      { fullName: guardian.full_name, relationship: guardian.relationship },
    ])
  );

  return NextResponse.json({
    school,
    students: (students ?? []).map((student) => ({
      ...student,
      guardian: guardianByStudent.get(student.id) ?? null,
      enrollment: enrollmentByStudent.get(student.id) ?? null,
      attendance: {
        classes: (classAttendance ?? [])
          .filter((record) => record.student_id === student.id)
          .map((record) => ({
            id: record.id,
            date: record.session_date,
            period: record.period_key,
            status: record.status,
            note: record.note,
            assignment: Array.isArray(record.teacher_assignment)
              ? record.teacher_assignment[0]
              : record.teacher_assignment,
          })),
        homeroom: (homeroomAttendance ?? [])
          .filter((record) => record.student_id === student.id)
          .map((record) => ({
            id: record.id,
            date: record.attendance_date,
            period: record.period,
            status: record.status,
            note: record.note,
            classroom: Array.isArray(record.classroom) ? record.classroom[0] : record.classroom,
          })),
      },
    })),
  });
}
