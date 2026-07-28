import 'server-only';

import { paths } from 'src/routes/paths';

import { supabaseAdmin } from './supabase-admin';
import { createNotifications } from './notifications';
import { schoolHasFeature } from './school-subscription';
import { decryptLineCredential } from './line-credentials';

// ----------------------------------------------------------------------

// Grade review statuses where the teacher still has to act — no row at all
// (never touched) counts the same as 'draft'; 'revision' means an approver
// kicked it back. Anything past that ('submitted' and beyond) is out of the
// teacher's hands.
const INCOMPLETE_STATUSES = new Set(['draft', 'revision']);

function todayInBangkok(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
}

function inReminderWindow(deadline: string, reminderDays: number, today: string): boolean {
  const deadlineDate = new Date(`${deadline}T00:00:00+07:00`);
  const todayDate = new Date(`${today}T00:00:00+07:00`);
  const daysUntilDeadline = Math.round(
    (deadlineDate.getTime() - todayDate.getTime()) / (24 * 60 * 60_000)
  );
  return daysUntilDeadline >= 0 && daysUntilDeadline < reminderDays;
}

type PendingTeacher = {
  teacherId: string;
  schoolId: string;
  semesterId: string;
  semesterName: string;
  deadline: string;
  pendingCount: number;
  subjectNames: string[];
  notifyInApp: boolean;
  notifyLine: boolean;
};

async function findPendingTeachers(): Promise<PendingTeacher[]> {
  const today = todayInBangkok();

  const { data: semesters } = await supabaseAdmin
    .from('semesters')
    .select(
      'id, name, grade_submission_deadline, grade_reminder_days, grade_reminder_notify_in_app, grade_reminder_notify_line, academic_year:academic_years!inner(school_id)'
    )
    .eq('is_active', true)
    .not('grade_submission_deadline', 'is', null)
    .not('grade_reminder_days', 'is', null);

  const dueSemesters = (semesters ?? []).filter(
    (semester) =>
      semester.grade_submission_deadline &&
      semester.grade_reminder_days &&
      (semester.grade_reminder_notify_in_app || semester.grade_reminder_notify_line) &&
      inReminderWindow(semester.grade_submission_deadline, semester.grade_reminder_days, today)
  );
  if (!dueSemesters.length) return [];

  const results: PendingTeacher[] = [];

  for (const semester of dueSemesters) {
    const academicYear = Array.isArray(semester.academic_year)
      ? semester.academic_year[0]
      : semester.academic_year;
    if (!academicYear?.school_id) continue;

    const { data: assignments } = await supabaseAdmin
      .from('teacher_assignments')
      .select(
        `teacher_id,
         subject:subjects(name),
         review:grade_review_submissions(status)`
      )
      .eq('semester_id', semester.id);

    const pendingByTeacher = new Map<string, { count: number; subjectNames: string[] }>();
    for (const assignment of assignments ?? []) {
      const review = Array.isArray(assignment.review) ? assignment.review[0] : assignment.review;
      const status = review?.status ?? 'draft';
      if (!INCOMPLETE_STATUSES.has(status)) continue;

      const subject = Array.isArray(assignment.subject) ? assignment.subject[0] : assignment.subject;
      const entry = pendingByTeacher.get(assignment.teacher_id) ?? { count: 0, subjectNames: [] };
      entry.count += 1;
      if (subject?.name) entry.subjectNames.push(subject.name);
      pendingByTeacher.set(assignment.teacher_id, entry);
    }

    for (const [teacherId, entry] of pendingByTeacher) {
      results.push({
        teacherId,
        schoolId: academicYear.school_id,
        semesterId: semester.id,
        semesterName: semester.name,
        deadline: semester.grade_submission_deadline!,
        pendingCount: entry.count,
        subjectNames: entry.subjectNames,
        notifyInApp: semester.grade_reminder_notify_in_app,
        notifyLine: semester.grade_reminder_notify_line,
      });
    }
  }

  return results;
}

function formatThaiDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00+07:00`));
}

function reminderText(pending: PendingTeacher) {
  const subjectList = pending.subjectNames.slice(0, 3).join(', ');
  const remainder = pending.subjectNames.length - 3;
  const subjectLine =
    subjectList + (remainder > 0 ? ` และอีก ${remainder} รายวิชา` : '');
  return {
    title: `เตือนส่งผลการเรียน ${pending.pendingCount} รายวิชา`,
    body: [
      `คุณมีรายวิชาที่ยังไม่ส่งผลการเรียน ${pending.pendingCount} รายการ (${subjectLine})`,
      `ภาคเรียน ${pending.semesterName} กำหนดส่งภายในวันที่ ${formatThaiDate(pending.deadline)}`,
      'อย่าลืมกรอกคะแนนบนระบบ สพฐ ด้วย',
    ].join('\n'),
  };
}

async function claimReminderSlot(
  pending: PendingTeacher,
  channel: 'in_app' | 'line',
  today: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('grade_reminder_log')
    .upsert(
      {
        school_id: pending.schoolId,
        teacher_id: pending.teacherId,
        semester_id: pending.semesterId,
        channel,
        sent_date: today,
      },
      { onConflict: 'teacher_id,semester_id,channel,sent_date', ignoreDuplicates: true }
    )
    .select('id');
  if (error) {
    console.error('Unable to claim grade reminder slot', error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

async function sendInAppReminder(pending: PendingTeacher, today: string) {
  if (!(await claimReminderSlot(pending, 'in_app', today))) return;

  const { title, body } = reminderText(pending);
  await createNotifications([
    {
      userId: pending.teacherId,
      schoolId: pending.schoolId,
      type: 'grade_submission_reminder',
      title,
      body,
      link: paths.teacher.gradeReviews,
    },
  ]);
}

async function sendLineReminder(
  pending: PendingTeacher,
  today: string,
  accessToken: string,
  lineUserId: string
) {
  if (!(await claimReminderSlot(pending, 'line', today))) return;

  const { title, body } = reminderText(pending);
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text: `🔔 ${title}\n${body}` }],
      }),
    });
    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(`LINE ${response.status}: ${responseBody.slice(0, 500)}`);
    }
  } catch (error) {
    await supabaseAdmin
      .from('grade_reminder_log')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message.slice(0, 1000) : 'ส่ง LINE ไม่สำเร็จ',
      })
      .eq('teacher_id', pending.teacherId)
      .eq('semester_id', pending.semesterId)
      .eq('channel', 'line')
      .eq('sent_date', today);
  }
}

export async function processGradeSubmissionReminders() {
  const today = todayInBangkok();
  const pendingTeachers = await findPendingTeachers();
  if (!pendingTeachers.length) return { teachersReminded: 0 };

  const teacherIds = Array.from(new Set(pendingTeachers.map((item) => item.teacherId)));
  const { data: teachers } = await supabaseAdmin
    .from('app_users')
    .select('id, line_user_id, line_notifications_enabled')
    .in('id', teacherIds);
  const teacherById = new Map((teachers ?? []).map((teacher) => [teacher.id, teacher]));

  const schoolIds = Array.from(new Set(pendingTeachers.map((item) => item.schoolId)));
  const lineTokenBySchool = new Map<string, string | null>();
  for (const schoolId of schoolIds) {
    if (!(await schoolHasFeature(schoolId, 'admin.line_notifications'))) {
      lineTokenBySchool.set(schoolId, null);
      continue;
    }
    const { data: integration } = await supabaseAdmin
      .from('school_line_integrations')
      .select('is_enabled, channel_access_token_encrypted')
      .eq('school_id', schoolId)
      .maybeSingle();
    lineTokenBySchool.set(
      schoolId,
      integration?.is_enabled && integration.channel_access_token_encrypted
        ? decryptLineCredential(integration.channel_access_token_encrypted)
        : null
    );
  }

  let teachersReminded = 0;
  for (const pending of pendingTeachers) {
    if (pending.notifyInApp) {
      await sendInAppReminder(pending, today);
    }

    const teacher = teacherById.get(pending.teacherId);
    const lineToken = lineTokenBySchool.get(pending.schoolId);
    if (
      pending.notifyLine &&
      teacher?.line_user_id &&
      teacher.line_notifications_enabled &&
      lineToken
    ) {
      await sendLineReminder(pending, today, lineToken, teacher.line_user_id);
    }
    teachersReminded += 1;
  }

  return { teachersReminded };
}
