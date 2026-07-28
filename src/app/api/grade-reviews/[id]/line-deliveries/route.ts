import { after, NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { schoolHasFeature } from 'src/lib/school-subscription';
import { loadTeacherAssignment } from 'src/lib/teacher-assignment-access';
import {
  canViewViaPermission,
  canManageViaPermission,
} from 'src/lib/department-permission-access';
import {
  queueGradeResultNotifications,
  processPendingLineNotifications,
} from 'src/lib/line-notifications';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

async function loadAccess(request: Request, teacherAssignmentId: string) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller?.schoolId) return null;

  const assignment = await loadTeacherAssignment(teacherAssignmentId);
  const schoolId = (
    assignment?.classrooms as unknown as { school_id: string } | null
  )?.school_id;
  if (!assignment || schoolId !== caller.schoolId) return null;

  const mayView =
    (await canViewViaPermission(caller, 'grades.review')) ||
    (await canViewViaPermission(caller, 'grades.approve'));
  if (!mayView) return null;

  return { caller, assignment };
}

async function loadSubmission(teacherAssignmentId: string) {
  const { data } = await supabaseAdmin
    .from('grade_review_submissions')
    .select('id, status')
    .eq('teacher_assignment_id', teacherAssignmentId)
    .maybeSingle();
  return data;
}

async function loadBatchId(schoolId: string, classroomId: string, semesterId: string) {
  const { data } = await supabaseAdmin
    .from('grade_result_delivery_batches')
    .select('id')
    .eq('school_id', schoolId)
    .eq('classroom_id', classroomId)
    .eq('semester_id', semesterId)
    .maybeSingle();
  return data?.id ?? null;
}

async function loadDeliveries(schoolId: string, batchId?: string | null) {
  if (!batchId) return [];

  const { data } = await supabaseAdmin
    .from('line_notification_deliveries')
    .select(
      `id, status, attempts, last_error, sent_at, created_at,
       guardian:student_guardians!line_notification_deliveries_guardian_id_fkey(full_name),
       student:app_users!line_notification_deliveries_student_id_fkey(
         username, name_prefix, first_name, last_name, student_code
       )`
    )
    .eq('school_id', schoolId)
    .eq('source_type', 'grade_result')
    .eq('source_record_id', batchId)
    .order('created_at', { ascending: false });

  return data ?? [];
}

async function loadRecipientPreview(schoolId: string, classroomId: string) {
  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select(
      `student_id,
       student:app_users!enrollments_student_id_fkey!inner(
         id, username, name_prefix, first_name, last_name, student_code, school_id, role
       )`
    )
    .eq('classroom_id', classroomId)
    .eq('student.school_id', schoolId)
    .eq('student.role', 'student');

  const students = (enrollments ?? []).flatMap((enrollment) => {
    const student = Array.isArray(enrollment.student) ? enrollment.student[0] : enrollment.student;
    return student ? [student] : [];
  });
  const studentIds = students.map((student) => student.id);
  const { data: guardians } = studentIds.length
    ? await supabaseAdmin
        .from('student_guardians')
        .select('student_id, full_name, line_user_id, line_notifications_enabled, is_primary')
        .eq('school_id', schoolId)
        .in('student_id', studentIds)
        .order('is_primary', { ascending: false })
    : { data: [] };

  type RecipientGuardian = {
    student_id: string;
    full_name: string;
    line_user_id: string | null;
    line_notifications_enabled: boolean;
    is_primary: boolean;
  };
  const guardiansByStudent = new Map<string, RecipientGuardian[]>();
  for (const guardian of (guardians ?? []) as RecipientGuardian[]) {
    const values = guardiansByStudent.get(guardian.student_id) ?? [];
    values.push(guardian);
    guardiansByStudent.set(guardian.student_id, values);
  }

  const recipients = students.map((student) => {
    const studentGuardians = guardiansByStudent.get(student.id) ?? [];
    const linkedGuardian = studentGuardians.find(
      (guardian) => guardian.line_user_id && guardian.line_notifications_enabled
    );
    const displayGuardian = linkedGuardian ?? studentGuardians[0];
    return {
      studentId: student.id,
      studentName:
        `${student.name_prefix ?? ''}${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() ||
        student.username ||
        '-',
      studentCode: student.student_code ?? null,
      guardianName: displayGuardian?.full_name ?? null,
      lineConnected: Boolean(linkedGuardian),
    };
  });

  return {
    recipients,
    eligibleStudents: recipients.length,
    linkedStudents: recipients.filter((recipient) => recipient.lineConnected).length,
  };
}

function responsePayload(
  deliveries: Awaited<ReturnType<typeof loadDeliveries>>,
  eligibleStudents = 0,
  linkedStudents = 0,
  subjectCount = 0,
  recipients: Awaited<ReturnType<typeof loadRecipientPreview>>['recipients'] = []
) {
  const counts = {
    total: deliveries.length,
    pending: deliveries.filter((item) => ['pending', 'processing'].includes(item.status)).length,
    sent: deliveries.filter((item) => item.status === 'sent').length,
    failed: deliveries.filter((item) => item.status === 'failed').length,
    skipped: deliveries.filter((item) => item.status === 'skipped').length,
  };

  return {
    counts,
    eligibleStudents,
    linkedStudents,
    subjectCount,
    recipients,
    deliveries: deliveries.map((delivery) => {
      const guardian = Array.isArray(delivery.guardian)
        ? delivery.guardian[0]
        : delivery.guardian;
      const student = Array.isArray(delivery.student) ? delivery.student[0] : delivery.student;
      return {
        id: delivery.id,
        status: delivery.status,
        attempts: delivery.attempts,
        error: delivery.last_error,
        sentAt: delivery.sent_at,
        createdAt: delivery.created_at,
        guardianName: guardian?.full_name ?? '-',
        studentName:
          `${student?.name_prefix ?? ''}${student?.first_name ?? ''} ${student?.last_name ?? ''}`.trim() ||
          student?.username ||
          '-',
        studentCode: student?.student_code ?? null,
      };
    }),
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const access = await loadAccess(request, id);
  if (!access?.caller.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดูประวัติการส่งผลการเรียน' }, { status: 403 });
  }

  const batchId = await loadBatchId(
    access.caller.schoolId,
    access.assignment.classroom_id,
    access.assignment.semester_id
  );
  const [deliveries, preview] = await Promise.all([
    loadDeliveries(access.caller.schoolId, batchId),
    loadRecipientPreview(access.caller.schoolId, access.assignment.classroom_id),
  ]);
  return NextResponse.json(
    responsePayload(
      deliveries,
      preview.eligibleStudents,
      preview.linkedStudents,
      0,
      preview.recipients
    )
  );
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { studentIds?: unknown };
  const studentIds = Array.isArray(body.studentIds)
    ? [
        ...new Set(
          body.studentIds.filter(
            (studentId): studentId is string => typeof studentId === 'string' && studentId.length > 0
          )
        ),
      ]
    : undefined;
  if (Array.isArray(body.studentIds) && !studentIds?.length) {
    return NextResponse.json({ message: 'กรุณาเลือกนักเรียนอย่างน้อย 1 คน' }, { status: 400 });
  }
  if (studentIds && studentIds.length > 200) {
    return NextResponse.json({ message: 'เลือกนักเรียนได้สูงสุด 200 คนต่อครั้ง' }, { status: 400 });
  }
  const access = await loadAccess(request, id);
  if (!access?.caller.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ส่งผลการเรียน' }, { status: 403 });
  }
  if (!(await canManageViaPermission(access.caller, 'grades.review'))) {
    return NextResponse.json(
      { message: 'ต้องได้รับสิทธิ์จัดการผลการเรียนจึงจะส่งให้ผู้ปกครองได้' },
      { status: 403 }
    );
  }
  const [hasGradeFeature, hasLineFeature] = await Promise.all([
    schoolHasFeature(access.caller.schoolId, 'academic.grade_workflow'),
    schoolHasFeature(access.caller.schoolId, 'admin.line_notifications'),
  ]);
  if (!hasGradeFeature || !hasLineFeature) {
    return NextResponse.json(
      { message: 'แพ็กเกจโรงเรียนยังไม่รองรับผลการเรียนหรือการแจ้งเตือน LINE' },
      { status: 403 }
    );
  }

  const submission = await loadSubmission(id);
  if (!submission || !['approved', 'locked'].includes(submission.status)) {
    return NextResponse.json(
      { message: 'ส่งได้เฉพาะผลการเรียนที่อนุมัติแล้วเท่านั้น' },
      { status: 409 }
    );
  }

  try {
    const queued = await queueGradeResultNotifications({
      schoolId: access.caller.schoolId,
      teacherAssignmentId: id,
      requestedBy: access.caller.sub,
      baseUrl:
        process.env.NEXT_PUBLIC_SERVER_URL?.trim().replace(/\/+$/, '') ||
        new URL(request.url).origin,
      studentIds,
    });
    if (!queued.ready) {
      return NextResponse.json(
        { message: 'กรุณาเปิดใช้งาน LINE Official Account และบันทึก Channel access token ก่อน' },
        { status: 409 }
      );
    }

    if (queued.deliveryIds.length) {
      after(async () => {
        await processPendingLineNotifications(access.caller.schoolId!, queued.deliveryIds);
      });
    }
    const deliveries = await loadDeliveries(access.caller.schoolId, queued.batchId);
    return NextResponse.json(
      responsePayload(
        deliveries,
        queued.eligibleStudents,
        queued.linkedStudents,
        queued.subjectCount
      )
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'ไม่สามารถนำผลการเรียนเข้าคิว LINE ได้' },
      { status: 500 }
    );
  }
}
