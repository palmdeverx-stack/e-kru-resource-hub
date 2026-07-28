import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

import { supabaseAdmin } from './supabase-admin';
import { decryptLineCredential } from './line-credentials';
import { isSubscriptionUsable } from './school-subscription';

// ----------------------------------------------------------------------

type AttendanceStatus = 'present' | 'absent' | 'leave' | 'late';
type SourceType = 'homeroom_attendance' | 'class_attendance' | 'announcement' | 'grade_result';
type EventType =
  | 'absent'
  | 'leave'
  | 'late'
  | 'class_absent'
  | 'announcement'
  | 'grade_result';
type AttendanceEventType = Exclude<EventType, 'announcement'>;

export type AttendanceNotificationInput = {
  sourceRecordId: string;
  studentId: string;
  status: AttendanceStatus;
  note?: string | null;
};

type QueueParams = {
  schoolId: string;
  sourceType: Exclude<SourceType, 'announcement'>;
  attendanceDate: string;
  contextLabel: string;
  records: AttendanceNotificationInput[];
};

const STATUS_LABEL: Record<EventType, string> = {
  absent: 'ขาด',
  leave: 'ลา',
  late: 'สาย',
  class_absent: 'ไม่เข้าเรียนรายคาบ',
  announcement: 'ประกาศ',
  grade_result: 'ผลการเรียน',
};

function eventTypeFor(
  sourceType: Exclude<SourceType, 'announcement'>,
  status: AttendanceStatus
): AttendanceEventType | null {
  if (status === 'present') return null;
  if (sourceType === 'class_attendance' && status === 'absent') return 'class_absent';
  return status;
}

function eventEnabled(
  eventType: AttendanceEventType,
  integration: {
    notify_absent: boolean;
    notify_leave: boolean;
    notify_late: boolean;
    notify_class_absent: boolean;
  }
) {
  if (eventType === 'absent') return integration.notify_absent;
  if (eventType === 'leave') return integration.notify_leave;
  if (eventType === 'late') return integration.notify_late;
  return integration.notify_class_absent;
}

function formatAttendanceDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00+07:00`));
}

export async function queueAttendanceNotifications({
  schoolId,
  sourceType,
  attendanceDate,
  contextLabel,
  records,
}: QueueParams) {
  const relevantRecords = records
    .map((record) => ({ ...record, eventType: eventTypeFor(sourceType, record.status) }))
    .filter((record): record is AttendanceNotificationInput & { eventType: AttendanceEventType } =>
      Boolean(record.eventType)
    );
  if (!relevantRecords.length) return [];

  const { data: holiday } = await supabaseAdmin
    .from('school_holidays')
    .select('id')
    .eq('school_id', schoolId)
    .eq('holiday_date', attendanceDate)
    .maybeSingle();
  if (holiday) return [];

  const [{ data: integration }, { data: subscription }, { data: school }] = await Promise.all([
    supabaseAdmin
      .from('school_line_integrations')
      .select(
        'is_enabled, channel_access_token_encrypted, notify_absent, notify_leave, notify_late, notify_class_absent'
      )
      .eq('school_id', schoolId)
      .maybeSingle(),
    supabaseAdmin
      .from('school_subscriptions')
      .select('status, ends_at, enabled_features, max_line_notifications')
      .eq('school_id', schoolId)
      .maybeSingle(),
    supabaseAdmin.from('schools').select('name').eq('id', schoolId).maybeSingle(),
  ]);

  if (
    !integration?.is_enabled ||
    !integration.channel_access_token_encrypted ||
    !subscription ||
    !isSubscriptionUsable(subscription as never) ||
    !(subscription.enabled_features ?? []).includes('admin.line_notifications')
  ) {
    return [];
  }

  const enabledRecords = relevantRecords.filter((record) =>
    eventEnabled(record.eventType, integration)
  );
  if (!enabledRecords.length) return [];

  const studentIds = Array.from(new Set(enabledRecords.map((record) => record.studentId)));
  const [{ data: students }, { data: guardians }] = await Promise.all([
    supabaseAdmin
      .from('app_users')
      .select('id, username, name_prefix, first_name, last_name, student_code')
      .eq('school_id', schoolId)
      .in('id', studentIds),
    supabaseAdmin
      .from('student_guardians')
      .select('id, student_id, line_user_id, line_notifications_enabled')
      .eq('school_id', schoolId)
      .in('student_id', studentIds)
      .not('line_user_id', 'is', null)
      .eq('line_notifications_enabled', true),
  ]);

  const studentById = new Map((students ?? []).map((student) => [student.id, student]));
  const guardiansByStudent = new Map<string, typeof guardians>();
  for (const guardian of guardians ?? []) {
    const values = guardiansByStudent.get(guardian.student_id) ?? [];
    values.push(guardian);
    guardiansByStudent.set(guardian.student_id, values);
  }

  const deliveries = enabledRecords.flatMap((record) => {
    const student = studentById.get(record.studentId);
    if (!student) return [];
    const studentName =
      `${student.name_prefix ?? ''}${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() ||
      student.username;
    const detailLines = [
      '🔔 แจ้งเตือนการเข้าเรียน',
      `โรงเรียน ${school?.name ?? ''}`,
      `นักเรียน ${studentName}`,
      student.student_code ? `รหัสนักเรียน ${student.student_code}` : '',
      `สถานะ ${STATUS_LABEL[record.eventType]}`,
      `วันที่ ${formatAttendanceDate(attendanceDate)}`,
      contextLabel,
      record.note ? `หมายเหตุ ${record.note}` : '',
    ].filter(Boolean);

    return (guardiansByStudent.get(record.studentId) ?? []).map((guardian) => ({
      school_id: schoolId,
      guardian_id: guardian.id,
      student_id: record.studentId,
      source_type: sourceType,
      source_record_id: record.sourceRecordId,
      event_type: record.eventType,
      message_text: detailLines.join('\n'),
      status: 'pending',
      attempts: 0,
      next_attempt_at: new Date().toISOString(),
    }));
  });
  if (!deliveries.length) return [];

  const { data, error } = await supabaseAdmin
    .from('line_notification_deliveries')
    .upsert(deliveries, {
      onConflict: 'guardian_id,source_type,source_record_id,event_type',
      ignoreDuplicates: true,
    })
    .select('id');
  if (error) {
    console.error('Unable to queue LINE notifications', error);
    return [];
  }
  return (data ?? []).map((row) => row.id);
}

export async function queueAnnouncementNotifications({
  schoolId,
  announcementId,
  title,
  content,
  imageUrl,
  classroomIds,
}: {
  schoolId: string;
  announcementId: string;
  title: string;
  content: string;
  imageUrl: string | null;
  classroomIds: string[];
}) {
  if (!classroomIds.length || (!content && !imageUrl)) return [];

  const [{ data: integration }, { data: subscription }, { data: school }] = await Promise.all([
    supabaseAdmin
      .from('school_line_integrations')
      .select('is_enabled, channel_access_token_encrypted')
      .eq('school_id', schoolId)
      .maybeSingle(),
    supabaseAdmin
      .from('school_subscriptions')
      .select('status, ends_at, enabled_features, max_line_notifications')
      .eq('school_id', schoolId)
      .maybeSingle(),
    supabaseAdmin.from('schools').select('name').eq('id', schoolId).maybeSingle(),
  ]);

  if (
    !integration?.is_enabled ||
    !integration.channel_access_token_encrypted ||
    !subscription ||
    !isSubscriptionUsable(subscription as never) ||
    !(subscription.enabled_features ?? []).includes('admin.line_notifications')
  ) {
    return [];
  }

  const { data: enrollments, error: enrollmentError } = await supabaseAdmin
    .from('enrollments')
    .select(
      `student_id,
       classroom:classrooms!inner(school_id),
       student:app_users!enrollments_student_id_fkey!inner(school_id, role, is_active, student_status)`
    )
    .in('classroom_id', classroomIds)
    .eq('classroom.school_id', schoolId)
    .eq('student.school_id', schoolId)
    .eq('student.role', 'student')
    .eq('student.is_active', true)
    .eq('student.student_status', 'studying');
  if (enrollmentError) {
    console.error('Unable to load announcement recipients', enrollmentError);
    return [];
  }

  const studentIds = Array.from(new Set((enrollments ?? []).map((row) => row.student_id)));
  if (!studentIds.length) return [];

  const guardianResults = await Promise.all(
    Array.from({ length: Math.ceil(studentIds.length / 200) }, (_, index) =>
      supabaseAdmin
        .from('student_guardians')
        .select('id, student_id, line_user_id')
        .eq('school_id', schoolId)
        .in('student_id', studentIds.slice(index * 200, (index + 1) * 200))
        .not('line_user_id', 'is', null)
        .eq('line_notifications_enabled', true)
    )
  );
  const guardianError = guardianResults.find((result) => result.error)?.error;
  if (guardianError) {
    console.error('Unable to load LINE guardians for announcement', guardianError);
    return [];
  }

  const recipientByLineId = new Map<
    string,
    { id: string; student_id: string; line_user_id: string }
  >();
  for (const guardian of guardianResults.flatMap((result) => result.data ?? [])) {
    if (guardian.line_user_id && !recipientByLineId.has(guardian.line_user_id)) {
      recipientByLineId.set(guardian.line_user_id, {
        id: guardian.id,
        student_id: guardian.student_id,
        line_user_id: guardian.line_user_id,
      });
    }
  }

  const messageText = [`📣 ${title}`, school?.name ? `โรงเรียน ${school.name}` : '', content]
    .filter(Boolean)
    .join('\n\n');
  const deliveries = Array.from(recipientByLineId.values()).map((guardian) => ({
    school_id: schoolId,
    guardian_id: guardian.id,
    student_id: guardian.student_id,
    source_type: 'announcement',
    source_record_id: announcementId,
    event_type: 'announcement',
    message_text: messageText,
    image_url: imageUrl,
    status: 'pending',
    attempts: 0,
    next_attempt_at: new Date().toISOString(),
  }));
  if (!deliveries.length) return [];

  const { data, error } = await supabaseAdmin
    .from('line_notification_deliveries')
    .upsert(deliveries, {
      onConflict: 'guardian_id,source_type,source_record_id,event_type',
      ignoreDuplicates: true,
    })
    .select('id');
  if (error) {
    console.error('Unable to queue LINE announcement', error);
    return [];
  }
  return (data ?? []).map((row) => row.id);
}

export async function queueGradeResultNotifications({
  schoolId,
  teacherAssignmentId,
  requestedBy,
  baseUrl,
  studentIds,
}: {
  schoolId: string;
  teacherAssignmentId: string;
  requestedBy: string;
  baseUrl: string;
  studentIds?: string[];
}) {
  const [
    { data: integration },
    { data: subscription },
    { data: school },
    { data: teacherAssignment },
  ] = await Promise.all([
    supabaseAdmin
      .from('school_line_integrations')
      .select('is_enabled, channel_access_token_encrypted')
      .eq('school_id', schoolId)
      .maybeSingle(),
    supabaseAdmin
      .from('school_subscriptions')
      .select('status, ends_at, enabled_features, max_line_notifications')
      .eq('school_id', schoolId)
      .maybeSingle(),
    supabaseAdmin.from('schools').select('name').eq('id', schoolId).maybeSingle(),
    supabaseAdmin
      .from('teacher_assignments')
      .select(
        `id, classroom_id, semester_id,
         classroom:classrooms!inner(school_id, name, academic_year:academic_years(year)),
         semester:semesters(name)`
      )
      .eq('id', teacherAssignmentId)
      .eq('classroom.school_id', schoolId)
      .maybeSingle(),
  ]);

  if (
    !integration?.is_enabled ||
    !integration.channel_access_token_encrypted ||
    !subscription ||
    !isSubscriptionUsable(subscription as never) ||
    !(subscription.enabled_features ?? []).includes('admin.line_notifications')
  ) {
    return {
      batchId: null,
      deliveryIds: [],
      eligibleStudents: 0,
      linkedStudents: 0,
      subjectCount: 0,
      ready: false,
    };
  }
  if (!teacherAssignment) {
    return {
      batchId: null,
      deliveryIds: [],
      eligibleStudents: 0,
      linkedStudents: 0,
      subjectCount: 0,
      ready: true,
    };
  }

  const [{ data: subjectAssignments }, { data: enrollments }] = await Promise.all([
    supabaseAdmin
      .from('teacher_assignments')
      .select(
        `id,
         subject:subjects(name, code),
         review:grade_review_submissions(status)`
      )
      .eq('classroom_id', teacherAssignment.classroom_id)
      .eq('semester_id', teacherAssignment.semester_id),
    supabaseAdmin
      .from('enrollments')
      .select(
        `student_id,
         student:app_users!enrollments_student_id_fkey!inner(
           id, username, name_prefix, first_name, last_name, student_code, school_id, role
         )`
      )
      .eq('classroom_id', teacherAssignment.classroom_id)
      .eq('student.school_id', schoolId)
      .eq('student.role', 'student'),
  ]);

  if (!subjectAssignments?.length) {
    throw new Error('ไม่พบรายวิชาในห้องและภาคเรียนนี้');
  }
  const incompleteSubjects = subjectAssignments.filter((item) => {
    const review = Array.isArray(item.review) ? item.review[0] : item.review;
    return !review || !['approved', 'locked'].includes(review.status);
  });
  if (incompleteSubjects.length) {
    throw new Error(
      `ยังส่งไม่ได้ มีผลการเรียนที่ยังไม่อนุมัติ ${incompleteSubjects.length} รายวิชา`
    );
  }

  const { data: batch, error: batchError } = await supabaseAdmin
    .from('grade_result_delivery_batches')
    .upsert(
      {
        school_id: schoolId,
        classroom_id: teacherAssignment.classroom_id,
        semester_id: teacherAssignment.semester_id,
        created_by: requestedBy,
      },
      { onConflict: 'school_id,classroom_id,semester_id' }
    )
    .select('id')
    .single();
  if (batchError || !batch) {
    throw new Error(batchError?.message ?? 'ไม่สามารถสร้างชุดส่งผลการเรียนได้');
  }

  const enrolledStudents = (enrollments ?? []).flatMap((enrollment) => {
    const student = Array.isArray(enrollment.student) ? enrollment.student[0] : enrollment.student;
    return student ? [student] : [];
  });
  const requestedStudentIds = studentIds ? new Set(studentIds) : null;
  const enrolledStudentIds = new Set(enrolledStudents.map((student) => student.id));
  if (
    requestedStudentIds &&
    [...requestedStudentIds].some((studentId) => !enrolledStudentIds.has(studentId))
  ) {
    throw new Error('พบนักเรียนที่เลือกซึ่งไม่ได้อยู่ในชั้นเรียนนี้');
  }
  const students = requestedStudentIds
    ? enrolledStudents.filter((student) => requestedStudentIds.has(student.id))
    : enrolledStudents;
  const recipientStudentIds = students.map((student) => student.id);
  if (!recipientStudentIds.length) {
    return {
      batchId: batch.id,
      deliveryIds: [],
      eligibleStudents: 0,
      linkedStudents: 0,
      subjectCount: subjectAssignments.length,
      ready: true,
    };
  }

  const { data: guardians } = await supabaseAdmin
      .from('student_guardians')
      .select('id, student_id, line_user_id, is_primary')
      .eq('school_id', schoolId)
      .in('student_id', recipientStudentIds)
      .not('line_user_id', 'is', null)
      .eq('line_notifications_enabled', true)
      .order('is_primary', { ascending: false });

  const guardiansByStudent = new Map<string, typeof guardians>();
  const recipientKeys = new Set<string>();
  for (const guardian of guardians ?? []) {
    if (!guardian.line_user_id) continue;
    const key = `${guardian.student_id}:${guardian.line_user_id}`;
    if (recipientKeys.has(key)) continue;
    recipientKeys.add(key);
    const values = guardiansByStudent.get(guardian.student_id) ?? [];
    values.push(guardian);
    guardiansByStudent.set(guardian.student_id, values);
  }

  const classroom = Array.isArray(teacherAssignment.classroom)
    ? teacherAssignment.classroom[0]
    : teacherAssignment.classroom;
  const semester = Array.isArray(teacherAssignment.semester)
    ? teacherAssignment.semester[0]
    : teacherAssignment.semester;
  const academicYear = classroom?.academic_year as unknown as
    | { year: string }
    | Array<{ year: string }>
    | null;
  const year = Array.isArray(academicYear) ? academicYear[0]?.year : academicYear?.year;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000);
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const { data: existingDeliveries } = await supabaseAdmin
    .from('line_notification_deliveries')
    .select('guardian_id')
    .eq('school_id', schoolId)
    .eq('source_type', 'grade_result')
    .eq('source_record_id', batch.id);
  const existingGuardianIds = new Set(
    (existingDeliveries ?? []).map((delivery) => delivery.guardian_id)
  );
  const deliveries: Array<Record<string, unknown>> = [];
  const shareTokens: Array<Record<string, unknown>> = [];

  for (const student of students) {
    const studentName =
      `${student.name_prefix ?? ''}${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() ||
      student.username;
    for (const guardian of guardiansByStudent.get(student.id) ?? []) {
      if (existingGuardianIds.has(guardian.id)) continue;
      const token = randomBytes(32).toString('base64url');
      shareTokens.push({
        batch_id: batch.id,
        school_id: schoolId,
        guardian_id: guardian.id,
        student_id: student.id,
        token_hash: createHash('sha256').update(token).digest('hex'),
        expires_at: expiresAt.toISOString(),
        revoked_at: null,
        created_by: requestedBy,
      });
      const imageUrl = `${normalizedBaseUrl}/api/guardian/grade-report/${token}/image`;
      deliveries.push({
        school_id: schoolId,
        guardian_id: guardian.id,
        student_id: student.id,
        source_type: 'grade_result',
        source_record_id: batch.id,
        event_type: 'grade_result',
        message_text: [
          '📘 ใบแจ้งผลการเรียน',
          school?.name ? `โรงเรียน ${school.name}` : '',
          `นักเรียน ${studentName}`,
          student.student_code ? `รหัสนักเรียน ${student.student_code}` : '',
          classroom?.name ? `ห้อง ${classroom.name}` : '',
          `ภาคเรียนที่ ${semester?.name ?? '-'} ปีการศึกษา ${year ?? '-'}`,
          `รวมผลการเรียน ${subjectAssignments.length} รายวิชา`,
        ]
          .filter((line) => line !== null && line !== undefined)
          .join('\n'),
        image_url: imageUrl,
        status: 'pending',
        attempts: 0,
        next_attempt_at: new Date().toISOString(),
        requested_by: requestedBy,
      });
    }
  }

  if (deliveries.length) {
    const { error: tokenError } = await supabaseAdmin
      .from('grade_report_share_tokens')
      .upsert(shareTokens, { onConflict: 'batch_id,guardian_id' });
    if (tokenError) throw tokenError;

    const { error: deliveryError } = await supabaseAdmin
      .from('line_notification_deliveries')
      .upsert(deliveries, {
        onConflict: 'guardian_id,source_type,source_record_id,event_type',
        ignoreDuplicates: true,
      });
    if (deliveryError) throw deliveryError;
  }

  const { data: deliveryRows } = await supabaseAdmin
    .from('line_notification_deliveries')
    .select('id')
    .eq('school_id', schoolId)
    .eq('source_type', 'grade_result')
    .eq('source_record_id', batch.id);

  return {
    batchId: batch.id,
    deliveryIds: (deliveryRows ?? []).map((row) => row.id),
    eligibleStudents: students.length,
    linkedStudents: guardiansByStudent.size,
    subjectCount: subjectAssignments.length,
    ready: true,
  };
}

export async function processPendingLineNotifications(schoolId: string, deliveryIds?: string[]) {
  const [{ data: integration }, { data: subscription }] = await Promise.all([
    supabaseAdmin
      .from('school_line_integrations')
      .select('is_enabled, channel_access_token_encrypted')
      .eq('school_id', schoolId)
      .maybeSingle(),
    supabaseAdmin
      .from('school_subscriptions')
      .select('status, ends_at, enabled_features, max_line_notifications')
      .eq('school_id', schoolId)
      .maybeSingle(),
  ]);
  if (
    !integration?.is_enabled ||
    !integration.channel_access_token_encrypted ||
    !subscription ||
    !isSubscriptionUsable(subscription as never) ||
    !(subscription.enabled_features ?? []).includes('admin.line_notifications')
  ) {
    return;
  }

  let query = supabaseAdmin
    .from('line_notification_deliveries')
    .select(
      'id, message_text, image_url, attempts, guardian:student_guardians!inner(line_user_id, line_notifications_enabled)'
    )
    .eq('school_id', schoolId)
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', new Date().toISOString())
    .order('created_at')
    .limit(100);
  if (deliveryIds?.length) query = query.in('id', deliveryIds);

  const { data: deliveries } = await query;
  if (!deliveries?.length) return;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin
    .from('line_notification_deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('status', 'sent')
    .gte('sent_at', monthStart.toISOString());

  let sentThisMonth = count ?? 0;
  const limit = subscription.max_line_notifications ?? 0;
  const accessToken = decryptLineCredential(integration.channel_access_token_encrypted);

  for (const delivery of deliveries) {
    const guardian = Array.isArray(delivery.guardian) ? delivery.guardian[0] : delivery.guardian;
    if (!guardian?.line_user_id || !guardian.line_notifications_enabled) {
      await supabaseAdmin
        .from('line_notification_deliveries')
        .update({ status: 'skipped', last_error: 'ผู้ปกครองยกเลิกการแจ้งเตือน LINE' })
        .eq('id', delivery.id);
      continue;
    }
    if (limit > 0 && sentThisMonth >= limit) {
      await supabaseAdmin
        .from('line_notification_deliveries')
        .update({ status: 'skipped', last_error: 'ครบโควตาแจ้งเตือน LINE ของแพ็กเกจแล้ว' })
        .eq('id', delivery.id);
      continue;
    }

    const nextAttempts = delivery.attempts + 1;
    const { data: claimed } = await supabaseAdmin
      .from('line_notification_deliveries')
      .update({ status: 'processing', attempts: nextAttempts })
      .eq('id', delivery.id)
      .in('status', ['pending', 'failed'])
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    try {
      const messages = [
        ...(delivery.message_text ? [{ type: 'text', text: delivery.message_text }] : []),
        ...(delivery.image_url
          ? [
              {
                type: 'image',
                originalContentUrl: delivery.image_url,
                previewImageUrl: delivery.image_url,
              },
            ]
          : []),
      ];
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          to: guardian.line_user_id,
          messages,
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`LINE ${response.status}: ${body.slice(0, 500)}`);
      }
      await supabaseAdmin
        .from('line_notification_deliveries')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', delivery.id);
      sentThisMonth += 1;
    } catch (error) {
      const retryAt = new Date(Date.now() + 5 * 60_000 * 2 ** Math.min(nextAttempts - 1, 4));
      await supabaseAdmin
        .from('line_notification_deliveries')
        .update({
          status: nextAttempts >= 3 ? 'skipped' : 'failed',
          next_attempt_at: retryAt.toISOString(),
          last_error: error instanceof Error ? error.message.slice(0, 1000) : 'ส่ง LINE ไม่สำเร็จ',
        })
        .eq('id', delivery.id);
    }
  }
}
