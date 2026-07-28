import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import {
  loadTeacherAssignment,
  canAccessTeacherAssignment,
} from 'src/lib/teacher-assignment-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

const STATUSES = ['present', 'absent', 'leave', 'late'] as const;
const SOURCES = ['daily', 'qr'] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type AttendanceStatus = (typeof STATUSES)[number];
type AttendanceSource = (typeof SOURCES)[number];

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

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const teacherAssignment = await loadTeacherAssignment(id);
  const classroom = teacherAssignment?.classrooms as unknown as
    | { school_id: string; name: string }
    | undefined;
  if (
    !canAccessTeacherAssignment(caller, teacherAssignment) ||
    classroom?.school_id !== caller.schoolId
  ) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId') ?? '';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const status = searchParams.get('status') ?? '';
  const source = searchParams.get('source') ?? '';
  const page = parsePositiveInteger(searchParams.get('page'), 1);
  const pageSize = Math.min(parsePositiveInteger(searchParams.get('pageSize'), 25), 500);

  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    return NextResponse.json({ message: 'ช่วงวันที่ไม่ถูกต้อง' }, { status: 400 });
  }
  if (status && !STATUSES.includes(status as AttendanceStatus)) {
    return NextResponse.json({ message: 'สถานะไม่ถูกต้อง' }, { status: 400 });
  }
  if (source && !SOURCES.includes(source as AttendanceSource)) {
    return NextResponse.json({ message: 'วิธีบันทึกไม่ถูกต้อง' }, { status: 400 });
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabaseAdmin
    .from('attendance')
    .select(
      `id, session_date, period_key, status, note, updated_at,
       student:app_users!attendance_student_id_fkey!inner(
         id, username, first_name, last_name, nickname, student_code, avatar_url,
         school_id, role
       )`,
      { count: 'exact' }
    )
    .eq('teacher_assignment_id', id)
    .eq('student.school_id', caller.schoolId)
    .eq('student.role', 'student')
    .gte('session_date', startDate)
    .lte('session_date', endDate)
    .order('session_date', { ascending: false })
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (studentId) query = query.eq('student_id', studentId);
  if (status) query = query.eq('status', status);
  if (source === 'daily') query = query.eq('period_key', 'daily');
  if (source === 'qr') query = query.like('period_key', 'qr:%');

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const records = (data ?? []).flatMap((record) => {
    const student = Array.isArray(record.student) ? record.student[0] : record.student;
    if (!student) return [];
    return [
      {
        id: record.id,
        attendanceDate: record.session_date,
        periodKey: record.period_key,
        status: record.status,
        note: record.note,
        updatedAt: record.updated_at,
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
