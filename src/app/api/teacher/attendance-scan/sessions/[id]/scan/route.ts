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
const QR_PATTERN = /^ISCORE-STUDENT:([0-9a-f-]{36})$/i;

export async function POST(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const payload = typeof body?.payload === 'string' ? body.payload.trim() : '';
  const token = QR_PATTERN.exec(payload)?.[1];
  if (!token) {
    return NextResponse.json({ message: 'QR ไม่ถูกต้องหรือไม่ใช่ QR นักเรียน' }, { status: 400 });
  }

  const session = await loadOwnedAttendanceScanSession(id, caller.sub, caller.schoolId);
  if (!session) {
    return NextResponse.json({ message: 'ไม่พบรอบเช็คชื่อนี้' }, { status: 404 });
  }
  const now = new Date();
  if (session.status !== 'open' || now > new Date(session.closes_at)) {
    return NextResponse.json({ message: 'รอบเช็คชื่อนี้ปิดแล้ว' }, { status: 409 });
  }

  const { data: qrCode } = await supabaseAdmin
    .from('student_qr_codes')
    .select(
      `student:app_users!student_qr_codes_student_id_fkey!inner(
         id, username, first_name, last_name, student_code, avatar_url,
         school_id, role, is_active, student_status
       )`
    )
    .eq('token', token)
    .eq('school_id', caller.schoolId)
    .eq('is_active', true)
    .eq('student.school_id', caller.schoolId)
    .eq('student.role', 'student')
    .maybeSingle();
  const student = Array.isArray(qrCode?.student) ? qrCode.student[0] : qrCode?.student;

  if (!student) {
    return NextResponse.json({ message: 'ไม่พบ QR นักเรียนในโรงเรียนนี้' }, { status: 404 });
  }
  if (!student.is_active || (student.student_status ?? 'studying') !== 'studying') {
    return NextResponse.json(
      { message: 'นักเรียนไม่มีสิทธิ์ใช้งานหรือพ้นสภาพแล้ว' },
      { status: 403 }
    );
  }

  const { data: enrollment } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('classroom_id', session.classroom_id)
    .eq('student_id', student.id)
    .maybeSingle();
  if (!enrollment) {
    return NextResponse.json({ message: 'นักเรียนไม่ได้ลงทะเบียนในชั้นเรียนนี้' }, { status: 403 });
  }

  const attendanceStatus = now > new Date(session.late_after) ? 'late' : 'present';
  const { data: event, error: eventError } = await supabaseAdmin
    .from('attendance_scan_events')
    .insert({
      session_id: id,
      student_id: student.id,
      status: attendanceStatus,
      scanned_at: now.toISOString(),
      recorded_by: caller.sub,
    })
    .select('id, scanned_at')
    .single();

  if (eventError?.code === '23505') {
    return NextResponse.json(
      { message: 'นักเรียนคนนี้เช็คชื่อในรอบนี้แล้ว', student },
      { status: 409 }
    );
  }
  if (eventError || !event) {
    return NextResponse.json(
      { message: eventError?.message ?? 'ไม่สามารถบันทึกการสแกนได้' },
      { status: 500 }
    );
  }

  const targetResult =
    session.session_type === 'class_period'
      ? await supabaseAdmin
          .from('attendance')
          .upsert(
            {
              teacher_assignment_id: session.teacher_assignment_id,
              student_id: student.id,
              session_date: session.session_date,
              period_key: `qr:${session.id}`,
              status: attendanceStatus,
              note: `QR · ${session.period_label ?? 'คาบเรียน'}`,
              recorded_by: caller.sub,
            },
            { onConflict: 'teacher_assignment_id,student_id,session_date,period_key' }
          )
          .select('id, student_id, status, note')
          .single()
      : await supabaseAdmin
          .from('homeroom_assembly_attendance')
          .upsert(
            {
              classroom_id: session.classroom_id,
              student_id: student.id,
              attendance_date: session.session_date,
              period: session.session_type === 'homeroom_morning' ? 'morning' : 'evening',
              status: attendanceStatus,
              note: 'บันทึกด้วย QR',
              recorded_by: caller.sub,
            },
            { onConflict: 'classroom_id,student_id,attendance_date,period' }
          )
          .select('id, student_id, status, note')
          .single();

  if (targetResult.error) {
    await supabaseAdmin.from('attendance_scan_events').delete().eq('id', event.id);
    return NextResponse.json({ message: targetResult.error.message }, { status: 500 });
  }

  if (attendanceStatus === 'late' && targetResult.data) {
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
        records: [
          {
            sourceRecordId: targetResult.data!.id,
            studentId: student.id,
            status: 'late',
            note: targetResult.data!.note,
          },
        ],
      });
      if (deliveryIds.length) {
        await processPendingLineNotifications(caller.schoolId!);
      }
    });
  }

  return NextResponse.json({
    result: {
      student: {
        id: student.id,
        username: student.username,
        firstName: student.first_name,
        lastName: student.last_name,
        studentCode: student.student_code,
        avatarUrl: student.avatar_url,
      },
      status: attendanceStatus,
      scannedAt: event.scanned_at,
    },
  });
}
