import { after, NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { loadOwnedAttendanceScanSession } from 'src/lib/attendance-scan-access';
import {
  queueAttendanceNotifications,
  processPendingLineNotifications,
} from 'src/lib/line-notifications';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  const { id } = await params;
  const session = await loadOwnedAttendanceScanSession(id, caller.sub, caller.schoolId);
  if (!session) {
    return NextResponse.json({ message: 'ไม่พบรอบเช็คชื่อนี้' }, { status: 404 });
  }

  const { data: events, error } = await supabaseAdmin
    .from('attendance_scan_events')
    .select(
      `id, status, scanned_at,
       student:app_users!attendance_scan_events_student_id_fkey(
         id, username, first_name, last_name, student_code, avatar_url
       )`
    )
    .eq('session_id', id)
    .order('scanned_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ session, events: events ?? [] });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  const { id } = await params;
  const session = await loadOwnedAttendanceScanSession(id, caller.sub, caller.schoolId);
  if (!session) {
    return NextResponse.json({ message: 'ไม่พบรอบเช็คชื่อนี้' }, { status: 404 });
  }
  if (session.status === 'closed') {
    return NextResponse.json({ success: true, absentCount: 0 });
  }

  const { error } = await supabaseAdmin
    .from('attendance_scan_sessions')
    .update({ status: 'closed' })
    .eq('id', id)
    .eq('teacher_id', caller.sub)
    .eq('school_id', caller.schoolId);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const [{ data: enrollments }, { data: scanEvents }] = await Promise.all([
    supabaseAdmin
      .from('enrollments')
      .select(
        'student:app_users!enrollments_student_id_fkey!inner(id, school_id, role, is_active, student_status)'
      )
      .eq('classroom_id', session.classroom_id)
      .eq('student.school_id', caller.schoolId)
      .eq('student.role', 'student')
      .eq('student.is_active', true)
      .eq('student.student_status', 'studying'),
    supabaseAdmin.from('attendance_scan_events').select('student_id').eq('session_id', id),
  ]);
  const scannedIds = new Set((scanEvents ?? []).map((event) => event.student_id));
  const absentStudentIds = (enrollments ?? []).flatMap((enrollment) => {
    const student = Array.isArray(enrollment.student) ? enrollment.student[0] : enrollment.student;
    return student && !scannedIds.has(student.id) ? [student.id] : [];
  });

  let absentRecords: Array<{
    id: string;
    student_id: string;
    status: 'absent';
    note: string | null;
  }> = [];
  if (absentStudentIds.length) {
    const result =
      session.session_type === 'class_period'
        ? await supabaseAdmin
            .from('attendance')
            .upsert(
              absentStudentIds.map((studentId) => ({
                teacher_assignment_id: session.teacher_assignment_id,
                student_id: studentId,
                session_date: session.session_date,
                period_key: `qr:${session.id}`,
                status: 'absent',
                note: `ไม่พบการสแกน QR · ${session.period_label ?? 'คาบเรียน'}`,
                recorded_by: caller.sub,
              })),
              { onConflict: 'teacher_assignment_id,student_id,session_date,period_key' }
            )
            .select('id, student_id, status, note')
        : await supabaseAdmin
            .from('homeroom_assembly_attendance')
            .upsert(
              absentStudentIds.map((studentId) => ({
                classroom_id: session.classroom_id,
                student_id: studentId,
                attendance_date: session.session_date,
                period: session.session_type === 'homeroom_morning' ? 'morning' : 'evening',
                status: 'absent',
                note: 'ไม่พบการสแกน QR ก่อนปิดรอบ',
                recorded_by: caller.sub,
              })),
              { onConflict: 'classroom_id,student_id,attendance_date,period' }
            )
            .select('id, student_id, status, note');
    if (result.error) {
      await supabaseAdmin
        .from('attendance_scan_sessions')
        .update({ status: 'open' })
        .eq('id', id)
        .eq('teacher_id', caller.sub);
      return NextResponse.json({ message: result.error.message }, { status: 500 });
    }
    absentRecords = (result.data ?? []) as typeof absentRecords;
  }

  if (absentRecords.length) {
    const classroom = Array.isArray(session.classroom) ? session.classroom[0] : session.classroom;
    const assignment = Array.isArray(session.teacher_assignment)
      ? session.teacher_assignment[0]
      : session.teacher_assignment;
    const subject = assignment
      ? Array.isArray(assignment.subject)
        ? assignment.subject[0]
        : assignment.subject
      : null;
    after(async () => {
      const deliveryIds = await queueAttendanceNotifications({
        schoolId: caller.schoolId!,
        sourceType:
          session.session_type === 'class_period' ? 'class_attendance' : 'homeroom_attendance',
        attendanceDate: session.session_date,
        contextLabel:
          session.session_type === 'class_period'
            ? `รายวิชา ${subject?.code ? `${subject.code} · ` : ''}${subject?.name ?? ''} · ${
                session.period_label ?? 'คาบเรียน'
              }${classroom?.name ? ` · ห้อง ${classroom.name}` : ''}`
            : session.session_type === 'homeroom_morning'
              ? 'เข้าแถวตอนเช้า'
              : 'เข้าแถวตอนเย็น',
        records: absentRecords.map((record) => ({
          sourceRecordId: record.id,
          studentId: record.student_id,
          status: 'absent',
          note: record.note,
        })),
      });
      if (deliveryIds.length) {
        await processPendingLineNotifications(caller.schoolId!);
      }
    });
  }

  return NextResponse.json({ success: true, absentCount: absentRecords.length });
}
