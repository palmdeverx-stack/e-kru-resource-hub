import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { loadTeacherAssignment } from 'src/lib/teacher-assignment-access';
import {
  canManageAssignmentSchedule,
  revertScheduleApprovalOnEdit,
} from 'src/lib/schedule-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string; scheduleId: string }> };

const DAY_LABEL = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id, scheduleId } = await params;
  const teacherAssignment = await loadTeacherAssignment(id);

  if (!(await canManageAssignmentSchedule(caller, teacherAssignment))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { dayOfWeek, startTime, endTime, locationName, schedulePeriodId } = await request.json();
  const normalizedLocation = typeof locationName === 'string' ? locationName.trim() : '';
  let resolvedStartTime = startTime;
  let resolvedEndTime = endTime;

  if (schedulePeriodId) {
    const { data: period } = await supabaseAdmin
      .from('schedule_periods')
      .select('id, start_time, end_time')
      .eq('id', schedulePeriodId)
      .eq('school_id', caller.schoolId)
      .eq('semester_id', teacherAssignment!.semester_id)
      .eq('is_break', false)
      .maybeSingle();
    if (!period) {
      return NextResponse.json({ message: 'ไม่พบคาบเรียนที่เลือก' }, { status: 400 });
    }
    resolvedStartTime = period.start_time;
    resolvedEndTime = period.end_time;
  }

  if (!dayOfWeek || !resolvedStartTime || !resolvedEndTime) {
    return NextResponse.json(
      { message: 'กรุณาเลือกวันและเวลาเริ่ม-สิ้นสุดให้ครบถ้วน' },
      { status: 400 }
    );
  }
  if (dayOfWeek < 1 || dayOfWeek > 7) {
    return NextResponse.json({ message: 'วันในสัปดาห์ไม่ถูกต้อง' }, { status: 400 });
  }
  if (resolvedStartTime >= resolvedEndTime) {
    return NextResponse.json({ message: 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น' }, { status: 400 });
  }
  if (normalizedLocation.length > 200) {
    return NextResponse.json(
      { message: 'ห้อง อาคาร หรือสถานที่สอนต้องไม่เกิน 200 ตัวอักษร' },
      { status: 400 }
    );
  }

  const { data: teacherSchedules } = await supabaseAdmin
    .from('teaching_schedules')
    .select(
      'id, day_of_week, start_time, end_time, teacher_assignment:teacher_assignments!inner(teacher_id, subject:subjects(name), classroom:classrooms(name))'
    )
    .eq('day_of_week', dayOfWeek)
    .eq('teacher_assignment.teacher_id', teacherAssignment!.teacher_id)
    .neq('id', scheduleId);

  const start = toMinutes(resolvedStartTime);
  const end = toMinutes(resolvedEndTime);
  const conflict = teacherSchedules?.find(
    (slot) => start < toMinutes(slot.end_time) && end > toMinutes(slot.start_time)
  );

  if (conflict) {
    const conflictAssignment = conflict.teacher_assignment as unknown as {
      subject: { name: string } | null;
      classroom: { name: string } | null;
    };
    return NextResponse.json(
      {
        message: `เวลานี้ครูมีคาบสอน "${conflictAssignment.subject?.name ?? ''}" ห้อง ${conflictAssignment.classroom?.name ?? ''} อยู่แล้ว (วัน${DAY_LABEL[dayOfWeek]} ${conflict.start_time}-${conflict.end_time})`,
      },
      { status: 409 }
    );
  }

  const { data: classroomSchedules } = await supabaseAdmin
    .from('teaching_schedules')
    .select(
      'id, day_of_week, start_time, end_time, teacher_assignment:teacher_assignments!inner(classroom_id, subject:subjects(name))'
    )
    .eq('day_of_week', dayOfWeek)
    .eq('teacher_assignment.classroom_id', teacherAssignment!.classroom_id)
    .neq('id', scheduleId)
    .neq('teacher_assignment_id', id);

  const classroomConflict = classroomSchedules?.find(
    (slot) => start < toMinutes(slot.end_time) && end > toMinutes(slot.start_time)
  );

  if (classroomConflict) {
    const conflictAssignment = classroomConflict.teacher_assignment as unknown as {
      subject: { name: string } | null;
    };
    return NextResponse.json(
      {
        message: `เวลานี้ห้องเรียนมีคาบวิชา "${conflictAssignment.subject?.name ?? ''}" อยู่แล้ว (วัน${DAY_LABEL[dayOfWeek]} ${classroomConflict.start_time}-${classroomConflict.end_time})`,
      },
      { status: 409 }
    );
  }

  const { data: schedule, error } = await supabaseAdmin
    .from('teaching_schedules')
    .update({
      day_of_week: dayOfWeek,
      start_time: resolvedStartTime,
      end_time: resolvedEndTime,
      location_name: normalizedLocation || null,
      schedule_period_id: schedulePeriodId || null,
    })
    .eq('id', scheduleId)
    .eq('teacher_assignment_id', id)
    .select('id, day_of_week, start_time, end_time, location_name, schedule_period_id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  if (!schedule) {
    return NextResponse.json({ message: 'ไม่พบคาบสอนที่ต้องการแก้ไข' }, { status: 404 });
  }

  await revertScheduleApprovalOnEdit(teacherAssignment!.classroom_id, teacherAssignment!.semester_id);

  return NextResponse.json({ schedule });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id, scheduleId } = await params;
  const teacherAssignment = await loadTeacherAssignment(id);

  if (!(await canManageAssignmentSchedule(caller, teacherAssignment))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('teaching_schedules')
    .delete()
    .eq('id', scheduleId)
    .eq('teacher_assignment_id', id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await revertScheduleApprovalOnEdit(teacherAssignment!.classroom_id, teacherAssignment!.semester_id);

  return NextResponse.json({ success: true });
}
