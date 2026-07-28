import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import {
  loadTeacherAssignment,
  canAccessTeacherAssignment,
} from 'src/lib/teacher-assignment-access';
import {
  hasTimetableCapability,
  canManageAssignmentSchedule,
  revertScheduleApprovalOnEdit,
} from 'src/lib/schedule-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const current = await loadTeacherAssignment(id);

  if (!canAccessTeacherAssignment(caller, current)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์แก้ไขรายการสอนนี้' }, { status: 403 });
  }

  const canManageAssignments =
    caller.role === 'school_admin' ||
    (await hasTimetableCapability(caller.sub, caller.schoolId));

  if (!canManageAssignments) {
    return NextResponse.json(
      { message: 'ไม่มีสิทธิ์แก้ไขวิชา ห้องเรียน หรือภาคเรียนของรายการสอนนี้ กรุณาติดต่อผู้ดูแลโรงเรียน' },
      { status: 403 }
    );
  }

  const { teacherId, subjectId, classroomId, semesterId } = await request.json();
  const resolvedTeacherId = teacherId || current!.teacher_id;

  if (!resolvedTeacherId || !subjectId || !classroomId || !semesterId) {
    return NextResponse.json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
  }

  const [{ data: teacher }, { data: subject }, { data: classroom }, { data: semester }] =
    await Promise.all([
      supabaseAdmin
        .from('app_users')
        .select('id')
        .eq('id', resolvedTeacherId)
        .eq('role', 'teacher')
        .eq('school_id', caller.schoolId)
        .maybeSingle(),
      supabaseAdmin
        .from('subjects')
        .select('id, academic_year_id')
        .eq('id', subjectId)
        .eq('semester_id', semesterId)
        .eq('school_id', caller.schoolId)
        .maybeSingle(),
      supabaseAdmin
        .from('classrooms')
        .select('id, academic_year_id')
        .eq('id', classroomId)
        .eq('school_id', caller.schoolId)
        .maybeSingle(),
      supabaseAdmin
        .from('semesters')
        .select('id, academic_year_id, academic_years!inner(school_id)')
        .eq('id', semesterId)
        .eq('academic_years.school_id', caller.schoolId)
        .maybeSingle(),
    ]);

  if (!teacher || !subject || !classroom || !semester) {
    return NextResponse.json(
      { message: 'ไม่พบครู วิชา ห้องเรียน หรือภาคเรียนนี้ในโรงเรียนของคุณ' },
      { status: 404 }
    );
  }

  if (
    subject.academic_year_id !== classroom.academic_year_id ||
    subject.academic_year_id !== semester.academic_year_id
  ) {
    return NextResponse.json(
      { message: 'รายวิชา ห้องเรียน และภาคเรียนต้องอยู่ในปีการศึกษาเดียวกัน' },
      { status: 400 }
    );
  }

  const { data: duplicate } = await supabaseAdmin
    .from('teacher_assignments')
    .select('id')
    .eq('subject_id', subjectId)
    .eq('classroom_id', classroomId)
    .eq('semester_id', semesterId)
    .neq('id', id)
    .limit(1)
    .maybeSingle();

  if (duplicate) {
    return NextResponse.json(
      { message: 'วิชานี้ในห้องนี้มีครูผู้สอนอยู่แล้วในภาคเรียนนี้' },
      { status: 409 }
    );
  }

  const { data: teacherAssignment, error } = await supabaseAdmin
    .from('teacher_assignments')
    .update({
      teacher_id: resolvedTeacherId,
      subject_id: subjectId,
      classroom_id: classroomId,
      semester_id: semesterId,
    })
    .eq('id', id)
    .select('id, teacher_id, subject_id, classroom_id, semester_id, created_at')
    .single();

  if (error || !teacherAssignment) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถแก้ไขรายการสอนได้' },
      { status: 500 }
    );
  }

  await revertScheduleApprovalOnEdit(current!.classroom_id, current!.semester_id);
  if (classroomId !== current!.classroom_id || semesterId !== current!.semester_id) {
    await revertScheduleApprovalOnEdit(classroomId, semesterId);
  }

  return NextResponse.json({ teacherAssignment });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const current = await loadTeacherAssignment(id);

  if (!(await canManageAssignmentSchedule(caller, current))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ลบรายการสอนนี้' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from('teacher_assignments').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await revertScheduleApprovalOnEdit(current!.classroom_id, current!.semester_id);

  return NextResponse.json({ success: true });
}
