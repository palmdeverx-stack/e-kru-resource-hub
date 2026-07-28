import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { schoolHasFeature } from 'src/lib/school-subscription';
import {
  loadTeacherAssignment,
  canAccessTeacherAssignment,
} from 'src/lib/teacher-assignment-access';

// ----------------------------------------------------------------------

const SESSION_TYPES = ['homeroom_morning', 'class_period', 'homeroom_evening'] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
type SessionType = (typeof SESSION_TYPES)[number];

export async function POST(request: Request) {
  const caller = requireRole(request, ['teacher']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  if (!(await schoolHasFeature(caller.schoolId, 'teacher.qr_attendance'))) {
    return NextResponse.json({ message: 'แพ็กเกจโรงเรียนไม่รองรับ QR เช็คชื่อ' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const sessionType = body?.sessionType as SessionType;
  const sessionDate = typeof body?.sessionDate === 'string' ? body.sessionDate : '';
  const classroomId = typeof body?.classroomId === 'string' ? body.classroomId : '';
  const teacherAssignmentId =
    typeof body?.teacherAssignmentId === 'string' ? body.teacherAssignmentId : '';
  const periodLabel =
    typeof body?.periodLabel === 'string' ? body.periodLabel.trim().slice(0, 100) : '';
  const durationMinutes = Number(body?.durationMinutes);
  const lateAfterMinutes = Number(body?.lateAfterMinutes);

  if (
    !SESSION_TYPES.includes(sessionType) ||
    !DATE_PATTERN.test(sessionDate) ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 5 ||
    durationMinutes > 480 ||
    !Number.isInteger(lateAfterMinutes) ||
    lateAfterMinutes < 0 ||
    lateAfterMinutes > durationMinutes
  ) {
    return NextResponse.json({ message: 'ข้อมูลรอบเช็คชื่อไม่ถูกต้อง' }, { status: 400 });
  }

  let resolvedClassroomId = classroomId;
  let resolvedTeacherAssignmentId: string | null = null;

  if (sessionType === 'class_period') {
    if (!teacherAssignmentId || !periodLabel) {
      return NextResponse.json({ message: 'กรุณาเลือกวิชาและระบุคาบเรียน' }, { status: 400 });
    }
    const teacherAssignment = await loadTeacherAssignment(teacherAssignmentId);
    if (!canAccessTeacherAssignment(caller, teacherAssignment)) {
      return NextResponse.json({ message: 'ไม่มีสิทธิ์เปิดรอบของวิชานี้' }, { status: 403 });
    }
    resolvedClassroomId = teacherAssignment!.classroom_id;
    resolvedTeacherAssignmentId = teacherAssignmentId;
  } else {
    if (!classroomId) {
      return NextResponse.json({ message: 'กรุณาเลือกชั้นเรียน' }, { status: 400 });
    }
    const { data: homeroom } = await supabaseAdmin
      .from('classroom_homeroom_teachers')
      .select('classroom:classrooms!inner(id, school_id)')
      .eq('classroom_id', classroomId)
      .eq('teacher_id', caller.sub)
      .eq('classroom.school_id', caller.schoolId)
      .maybeSingle();
    if (!homeroom) {
      return NextResponse.json(
        { message: 'คุณไม่ใช่ครูประจำชั้นของห้องเรียนนี้' },
        { status: 403 }
      );
    }
  }

  const openedAt = new Date();
  const lateAfter = new Date(openedAt.getTime() + lateAfterMinutes * 60_000);
  const closesAt = new Date(openedAt.getTime() + durationMinutes * 60_000);
  const { data, error } = await supabaseAdmin
    .from('attendance_scan_sessions')
    .insert({
      school_id: caller.schoolId,
      teacher_id: caller.sub,
      session_type: sessionType,
      classroom_id: resolvedClassroomId,
      teacher_assignment_id: resolvedTeacherAssignmentId,
      period_label:
        sessionType === 'homeroom_morning'
          ? 'เข้าแถวตอนเช้า'
          : sessionType === 'homeroom_evening'
            ? 'เข้าแถวตอนเย็น'
            : periodLabel,
      session_date: sessionDate,
      opened_at: openedAt.toISOString(),
      late_after: lateAfter.toISOString(),
      closes_at: closesAt.toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถเปิดรอบเช็คชื่อได้' },
      { status: 500 }
    );
  }

  return NextResponse.json({ sessionId: data.id }, { status: 201 });
}
