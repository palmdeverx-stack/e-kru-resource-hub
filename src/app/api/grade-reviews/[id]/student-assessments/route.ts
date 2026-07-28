import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canEditGradebook } from 'src/lib/grade-review-access';
import { loadTeacherAssignment } from 'src/lib/teacher-assignment-access';
import { canManageViaPermission } from 'src/lib/department-permission-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

const SPECIAL_RESULTS = ['ร', 'มส', 'มผ'] as const;
const ACTIVITY_RESULTS = ['pass', 'fail', 'pending'] as const;

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const assignment = await loadTeacherAssignment(id);
  const assignmentSchoolId = (
    assignment?.classrooms as unknown as { school_id: string } | null
  )?.school_id;
  if (!assignment || assignmentSchoolId !== caller.schoolId) {
    return NextResponse.json({ message: 'ไม่พบรายวิชานี้' }, { status: 404 });
  }

  const body = await request.json();
  const studentId = typeof body.studentId === 'string' ? body.studentId : '';
  if (!studentId) {
    return NextResponse.json({ message: 'กรุณาเลือกนักเรียน' }, { status: 400 });
  }

  const isOwner = caller.role === 'teacher' && assignment.teacher_id === caller.sub;
  const canReview = await canManageViaPermission(caller, 'grades.review');
  if (!canReview && (!isOwner || !(await canEditGradebook(id)))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์แก้ไขผลประเมิน' }, { status: 403 });
  }

  const { data: enrollment } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('classroom_id', assignment.classroom_id)
    .eq('student_id', studentId)
    .maybeSingle();
  if (!enrollment) {
    return NextResponse.json({ message: 'นักเรียนไม่ได้อยู่ในห้องเรียนนี้' }, { status: 404 });
  }

  const specialResult =
    body.specialResult === null || body.specialResult === ''
      ? null
      : typeof body.specialResult === 'string' &&
          SPECIAL_RESULTS.includes(body.specialResult as (typeof SPECIAL_RESULTS)[number])
        ? body.specialResult
        : undefined;
  if (specialResult === undefined) {
    return NextResponse.json({ message: 'ผลการเรียนพิเศษไม่ถูกต้อง' }, { status: 400 });
  }

  let desirableLevel: number | null = null;
  let readingLevel: number | null = null;
  let activityResult: string | null = null;
  if (canReview) {
    desirableLevel =
      body.desirableAttributesLevel === null || body.desirableAttributesLevel === ''
        ? null
        : Number(body.desirableAttributesLevel);
    readingLevel =
      body.readingThinkingWritingLevel === null || body.readingThinkingWritingLevel === ''
        ? null
        : Number(body.readingThinkingWritingLevel);
    activityResult =
      body.activityResult === null || body.activityResult === ''
        ? null
        : typeof body.activityResult === 'string' &&
            ACTIVITY_RESULTS.includes(body.activityResult as (typeof ACTIVITY_RESULTS)[number])
          ? body.activityResult
          : '__invalid__';
    if (
      (desirableLevel !== null &&
        (!Number.isInteger(desirableLevel) || desirableLevel < 0 || desirableLevel > 3)) ||
      (readingLevel !== null &&
        (!Number.isInteger(readingLevel) || readingLevel < 0 || readingLevel > 3)) ||
      activityResult === '__invalid__'
    ) {
      return NextResponse.json({ message: 'ระดับผลการประเมินไม่ถูกต้อง' }, { status: 400 });
    }
  }

  const { error: resultError } = await supabaseAdmin
    .from('teacher_assignment_student_results')
    .upsert(
      {
        school_id: caller.schoolId,
        teacher_assignment_id: id,
        student_id: studentId,
        special_result: specialResult,
        note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
        updated_by: caller.sub,
      },
      { onConflict: 'teacher_assignment_id,student_id' }
    );
  if (resultError) {
    return NextResponse.json({ message: resultError.message }, { status: 500 });
  }

  if (canReview) {
    const { error: assessmentError } = await supabaseAdmin
      .from('student_term_assessments')
      .upsert(
        {
          school_id: caller.schoolId,
          semester_id: assignment.semester_id,
          classroom_id: assignment.classroom_id,
          student_id: studentId,
          desirable_attributes_level: desirableLevel,
          reading_thinking_writing_level: readingLevel,
          activity_result: activityResult,
          note: typeof body.assessmentNote === 'string' && body.assessmentNote.trim()
            ? body.assessmentNote.trim()
            : null,
          updated_by: caller.sub,
        },
        { onConflict: 'semester_id,student_id' }
      );
    if (assessmentError) {
      return NextResponse.json({ message: assessmentError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
