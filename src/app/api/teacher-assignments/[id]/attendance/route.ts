import { after, NextResponse } from 'next/server';

import { today } from 'src/utils/format-time';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import {
  loadTeacherAssignment,
  canAccessTeacherAssignment,
} from 'src/lib/teacher-assignment-access';
import {
  queueAttendanceNotifications,
  processPendingLineNotifications,
} from 'src/lib/line-notifications';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

const VALID_STATUSES = ['present', 'absent', 'leave', 'late'] as const;

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const teacherAssignment = await loadTeacherAssignment(id);

  if (!canAccessTeacherAssignment(caller, teacherAssignment)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const sessionDate = new URL(request.url).searchParams.get('date') || today('YYYY-MM-DD');

  const [{ data: roster, error: rosterError }, { data: records, error: recordsError }] =
    await Promise.all([
      supabaseAdmin
        .from('enrollments')
        .select(
          'student_number, student:app_users(id, username, first_name, last_name, avatar_url)'
        )
        .eq('classroom_id', teacherAssignment!.classroom_id)
        .order('student_number'),
      supabaseAdmin
        .from('attendance')
        .select('id, student_id, status, note')
        .eq('teacher_assignment_id', id)
        .eq('session_date', sessionDate)
        .eq('period_key', 'daily'),
    ]);

  if (rosterError || recordsError) {
    return NextResponse.json(
      { message: rosterError?.message ?? recordsError?.message },
      { status: 500 }
    );
  }

  const recordByStudentId = new Map(records.map((record) => [record.student_id, record]));

  const rows = roster.map((row) => {
    const student = row.student as any;
    const existing = recordByStudentId.get(student.id) ?? null;

    return {
      student,
      studentNumber: row.student_number,
      attendance: existing ?? { id: null, status: 'present', note: null },
    };
  });

  return NextResponse.json({ sessionDate, rows });
}

export async function POST(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const teacherAssignment = await loadTeacherAssignment(id);

  if (!canAccessTeacherAssignment(caller, teacherAssignment)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { sessionDate, records } = await request.json();

  if (!sessionDate || !Array.isArray(records) || !records.length) {
    return NextResponse.json({ message: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  for (const record of records) {
    if (!record.studentId || !VALID_STATUSES.includes(record.status)) {
      return NextResponse.json({ message: 'สถานะการเช็คชื่อไม่ถูกต้อง' }, { status: 400 });
    }
  }

  const { data: enrolled } = await supabaseAdmin
    .from('enrollments')
    .select('student_id')
    .eq('classroom_id', teacherAssignment!.classroom_id)
    .in(
      'student_id',
      records.map((record: { studentId: string }) => record.studentId)
    );

  const enrolledIds = new Set((enrolled ?? []).map((row) => row.student_id));
  const invalid = records.some(
    (record: { studentId: string }) => !enrolledIds.has(record.studentId)
  );

  if (invalid) {
    return NextResponse.json({ message: 'นักเรียนบางคนไม่ได้อยู่ในห้องนี้' }, { status: 404 });
  }

  const { data: saved, error } = await supabaseAdmin
    .from('attendance')
    .upsert(
      records.map((record: { studentId: string; status: string; note?: string | null }) => ({
        teacher_assignment_id: id,
        student_id: record.studentId,
        session_date: sessionDate,
        period_key: 'daily',
        status: record.status,
        note: record.note || null,
        recorded_by: caller.sub,
      })),
      { onConflict: 'teacher_assignment_id,student_id,session_date,period_key' }
    )
    .select();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const classroom = teacherAssignment!.classrooms as unknown as { name?: string };
  const subject = teacherAssignment!.subjects as unknown as { name?: string; code?: string };
  after(async () => {
    const deliveryIds = await queueAttendanceNotifications({
      schoolId: caller.schoolId!,
      sourceType: 'class_attendance',
      attendanceDate: sessionDate,
      contextLabel: `รายวิชา ${subject?.code ? `${subject.code} · ` : ''}${subject?.name ?? ''}${
        classroom?.name ? ` · ห้อง ${classroom.name}` : ''
      }`,
      records: (saved ?? []).map((savedRecord) => ({
        sourceRecordId: savedRecord.id,
        studentId: savedRecord.student_id,
        status: savedRecord.status,
        note: savedRecord.note,
      })),
    });
    if (deliveryIds.length) {
      await processPendingLineNotifications(caller.schoolId!);
    }
  });

  return NextResponse.json({ records: saved });
}
