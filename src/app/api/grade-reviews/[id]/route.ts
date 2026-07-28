import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { loadTeacherAssignment } from 'src/lib/teacher-assignment-access';
import {
  canViewViaPermission,
  canManageViaPermission,
} from 'src/lib/department-permission-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };
type ReviewStatus = 'submitted' | 'revision' | 'reviewed' | 'approved' | 'locked';

const REVIEW_ACTIONS: Record<string, ReviewStatus> = {
  submit: 'submitted',
  revision: 'revision',
  review: 'reviewed',
  approve: 'approved',
  lock: 'locked',
};

const ALLOWED_FROM: Record<string, Array<ReviewStatus | 'draft'>> = {
  submit: ['draft', 'revision'],
  revision: ['submitted'],
  review: ['submitted'],
  approve: ['reviewed'],
  lock: ['approved'],
};

function classroomSchoolId(assignment: Awaited<ReturnType<typeof loadTeacherAssignment>>) {
  return (assignment?.classrooms as unknown as { school_id: string } | null)?.school_id ?? null;
}

async function getSubmission(teacherAssignmentId: string) {
  const { data } = await supabaseAdmin
    .from('grade_review_submissions')
    .select(
      `id, status, submitted_at, reviewed_at, approved_at, note,
       submitted_by:app_users!grade_review_submissions_submitted_by_fkey(first_name, last_name),
       reviewed_by:app_users!grade_review_submissions_reviewed_by_fkey(first_name, last_name),
       approved_by:app_users!grade_review_submissions_approved_by_fkey(first_name, last_name),
       events:grade_review_events(
         id, status, note, created_at,
         acted_by:app_users!grade_review_events_acted_by_fkey(first_name, last_name)
       )`
    )
    .eq('teacher_assignment_id', teacherAssignmentId)
    .maybeSingle();
  return data;
}

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const assignment = await loadTeacherAssignment(id);
  const ownsAssignment = caller.role === 'teacher' && assignment?.teacher_id === caller.sub;
  const canReview =
    (await canViewViaPermission(caller, 'grades.review')) ||
    (await canViewViaPermission(caller, 'grades.approve'));
  if (
    !assignment ||
    classroomSchoolId(assignment) !== caller.schoolId ||
    (!ownsAssignment && !canReview && caller.role !== 'school_admin')
  ) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึงผลการเรียนนี้' }, { status: 403 });
  }

  return NextResponse.json({ submission: await getSubmission(id) });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const assignment = await loadTeacherAssignment(id);
  if (!assignment || classroomSchoolId(assignment) !== caller.schoolId) {
    return NextResponse.json({ message: 'ไม่พบรายวิชานี้' }, { status: 404 });
  }

  const body = await request.json();
  const status = REVIEW_ACTIONS[body.action];
  if (!status) return NextResponse.json({ message: 'การดำเนินการไม่ถูกต้อง' }, { status: 400 });

  const currentSubmission = await getSubmission(id);
  const currentStatus = currentSubmission?.status ?? 'draft';
  if (!ALLOWED_FROM[body.action]?.includes(currentStatus)) {
    return NextResponse.json(
      { message: 'สถานะปัจจุบันไม่สามารถดำเนินการนี้ได้ กรุณาโหลดข้อมูลใหม่' },
      { status: 409 }
    );
  }

  const isOwner = caller.role === 'teacher' && assignment.teacher_id === caller.sub;
  const isSubmit = body.action === 'submit';
  const requiredPermission =
    body.action === 'approve' ? 'grades.approve' : 'grades.review';
  if (
    isSubmit
      ? !isOwner && caller.role !== 'school_admin'
      : !(await canManageViaPermission(caller, requiredPermission))
  ) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดำเนินการ' }, { status: 403 });
  }

  if (isSubmit) {
    const [{ data: assignments }, { data: enrollments }] = await Promise.all([
      supabaseAdmin.from('assignments').select('id').eq('teacher_assignment_id', id),
      supabaseAdmin
        .from('enrollments')
        .select('student_id')
        .eq('classroom_id', assignment.classroom_id),
    ]);
    const assignmentIds = (assignments ?? []).map((item) => item.id);
    if (!assignmentIds.length) {
      return NextResponse.json({ message: 'ต้องมีรายการคะแนนอย่างน้อย 1 รายการก่อนส่ง' }, { status: 400 });
    }
    const studentIds = (enrollments ?? []).map((item) => item.student_id);
    const [{ data: scores }, { data: specialResults }] = await Promise.all([
      supabaseAdmin
        .from('scores')
        .select('student_id, assignment_id, score, status')
        .in('assignment_id', assignmentIds),
      studentIds.length
        ? supabaseAdmin
            .from('teacher_assignment_student_results')
            .select('student_id, special_result')
            .eq('teacher_assignment_id', id)
            .not('special_result', 'is', null)
            .in('student_id', studentIds)
        : Promise.resolve({ data: [] }),
    ]);
    const specialStudentIds = new Set((specialResults ?? []).map((item) => item.student_id));
    const completedScoreKeys = new Set(
      (scores ?? [])
        .filter(
          (score) => score.score !== null || ['absent', 'sick_leave'].includes(score.status)
        )
        .map((score) => `${score.student_id}:${score.assignment_id}`)
    );
    const completed = studentIds.reduce(
      (total, studentId) =>
        total +
        (specialStudentIds.has(studentId)
          ? assignmentIds.length
          : assignmentIds.filter((assignmentId) =>
              completedScoreKeys.has(`${studentId}:${assignmentId}`)
            ).length),
      0
    );
    const expected = studentIds.length * assignmentIds.length;
    if (completed < expected) {
      return NextResponse.json(
        { message: `คะแนนยังไม่ครบ ${expected - completed} รายการ กรุณาบันทึกให้ครบก่อนส่ง` },
        { status: 400 }
      );
    }
  }

  const now = new Date().toISOString();
  const values: Record<string, unknown> = {
    school_id: caller.schoolId,
    teacher_assignment_id: id,
    status,
    note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
  };
  if (status === 'submitted') Object.assign(values, { submitted_by: caller.sub, submitted_at: now });
  if (status === 'reviewed' || status === 'revision') {
    Object.assign(values, { reviewed_by: caller.sub, reviewed_at: now });
  }
  if (status === 'approved' || status === 'locked') {
    Object.assign(values, { approved_by: caller.sub, approved_at: now });
  }

  const { data: submission, error } = await supabaseAdmin
    .from('grade_review_submissions')
    .upsert(values, { onConflict: 'teacher_assignment_id' })
    .select('id, status')
    .single();
  if (error || !submission) {
    return NextResponse.json({ message: error?.message ?? 'บันทึกสถานะไม่สำเร็จ' }, { status: 500 });
  }

  await supabaseAdmin.from('grade_review_events').insert({
    submission_id: submission.id,
    status,
    note: values.note,
    acted_by: caller.sub,
  });

  return NextResponse.json({ submission: await getSubmission(id) });
}
