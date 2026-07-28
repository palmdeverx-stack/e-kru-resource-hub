import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

const PERIODS = ['morning', 'evening'] as const;
const STATUSES = ['present', 'absent', 'leave', 'late'] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type AttendancePeriod = (typeof PERIODS)[number];
type AttendanceStatus = (typeof STATUSES)[number];

function validDate(value: string | null): value is string {
  return (
    typeof value === 'string' &&
    DATE_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const caller = requireRole(request, ['teacher']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classroomId = searchParams.get('classroomId') ?? '';
  const studentId = searchParams.get('studentId') ?? '';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const period = searchParams.get('period') ?? '';
  const status = searchParams.get('status') ?? '';
  const page = parsePositiveInteger(searchParams.get('page'), 1);
  const pageSize = Math.min(parsePositiveInteger(searchParams.get('pageSize'), 25), 500);

  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    return NextResponse.json({ message: 'ช่วงวันที่ไม่ถูกต้อง' }, { status: 400 });
  }
  if (period && !PERIODS.includes(period as AttendancePeriod)) {
    return NextResponse.json({ message: 'ช่วงเวลาไม่ถูกต้อง' }, { status: 400 });
  }
  if (status && !STATUSES.includes(status as AttendanceStatus)) {
    return NextResponse.json({ message: 'สถานะไม่ถูกต้อง' }, { status: 400 });
  }

  const { data: homeroomRows, error: homeroomError } = await supabaseAdmin
    .from('classroom_homeroom_teachers')
    .select('classroom:classrooms!inner(id, name, grade_level, school_id, academic_years(year))')
    .eq('teacher_id', caller.sub)
    .eq('classroom.school_id', caller.schoolId);

  if (homeroomError) {
    return NextResponse.json({ message: homeroomError.message }, { status: 500 });
  }

  const ownedClassrooms = (homeroomRows ?? []).flatMap((row) => {
    const classroom = Array.isArray(row.classroom) ? row.classroom[0] : row.classroom;
    return classroom ? [classroom] : [];
  });
  const ownedClassroomIds = ownedClassrooms.map((classroom) => classroom.id);

  if (classroomId && !ownedClassroomIds.includes(classroomId)) {
    return NextResponse.json({ message: 'คุณไม่ใช่ครูประจำชั้นของห้องเรียนนี้' }, { status: 403 });
  }
  if (!ownedClassroomIds.length) {
    return NextResponse.json({
      records: [],
      total: 0,
      page,
      pageSize,
    });
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabaseAdmin
    .from('homeroom_assembly_attendance')
    .select(
      `id, attendance_date, period, status, note, updated_at,
       classroom:classrooms!homeroom_assembly_attendance_classroom_id_fkey(
         id, name, grade_level, academic_years(year)
       ),
       student:app_users!homeroom_assembly_attendance_student_id_fkey!inner(
         id, username, first_name, last_name, nickname, student_code, avatar_url, school_id, role
       )`,
      { count: 'exact' }
    )
    .in('classroom_id', classroomId ? [classroomId] : ownedClassroomIds)
    .eq('student.school_id', caller.schoolId)
    .eq('student.role', 'student')
    .gte('attendance_date', startDate)
    .lte('attendance_date', endDate)
    .order('attendance_date', { ascending: false })
    .order('period', { ascending: true })
    .range(from, to);

  if (studentId) query = query.eq('student_id', studentId);
  if (period) query = query.eq('period', period);
  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const records = (data ?? []).flatMap((record) => {
    const classroom = Array.isArray(record.classroom) ? record.classroom[0] : record.classroom;
    const student = Array.isArray(record.student) ? record.student[0] : record.student;
    if (!classroom || !student) return [];

    return [
      {
        id: record.id,
        attendanceDate: record.attendance_date,
        period: record.period,
        status: record.status,
        note: record.note,
        updatedAt: record.updated_at,
        classroom,
        student: {
          id: student.id,
          username: student.username,
          firstName: student.first_name,
          lastName: student.last_name,
          nickname: student.nickname,
          studentCode: student.student_code,
          avatarUrl: student.avatar_url,
        },
      },
    ];
  });

  return NextResponse.json({
    records,
    total: count ?? 0,
    page,
    pageSize,
  });
}
