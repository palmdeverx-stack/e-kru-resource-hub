import 'server-only';

import { supabaseAdmin } from './supabase-admin';
import { queueAnnouncementNotifications, processPendingLineNotifications } from './line-notifications';

// ----------------------------------------------------------------------

const HOLIDAY_TYPE_LABEL: Record<string, string> = {
  regular: 'หยุดปกติ (ราชการ)',
  urgent: 'หยุดด่วน',
  special: 'หยุดพิเศษ',
};

const HOLIDAY_TYPE_PRIORITY: Record<string, 'normal' | 'important' | 'urgent'> = {
  regular: 'normal',
  urgent: 'urgent',
  special: 'important',
};

function todayInBangkok(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
}

function noticeDateFor(holidayDate: string, noticeDays: number): string {
  const date = new Date(`${holidayDate}T00:00:00+07:00`);
  date.setDate(date.getDate() - noticeDays);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(date);
}

function formatThaiDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00+07:00`));
}

type HolidayForAnnouncement = {
  id: string;
  school_id: string;
  holiday_date: string;
  name: string;
  holiday_type: string;
};

/**
 * Creates (and sends to LINE) the announcement for one holiday, and records
 * its id back on the holiday row. Used both by the "ทันที" (immediate) save
 * path and by the "ตั้งเวลา" (scheduled) daily cron.
 */
export async function createAnnouncementForHoliday(
  holiday: HolidayForAnnouncement
): Promise<string | null> {
  const { data: classrooms } = await supabaseAdmin
    .from('classrooms')
    .select('id')
    .eq('school_id', holiday.school_id);
  const classroomIds = (classrooms ?? []).map((classroom) => classroom.id);
  if (!classroomIds.length) return null;

  const title = `📅 แจ้งวันหยุด: ${holiday.name}`;
  const content = [
    `โรงเรียนหยุดวันที่ ${formatThaiDate(holiday.holiday_date)}`,
    `ประเภท: ${HOLIDAY_TYPE_LABEL[holiday.holiday_type] ?? holiday.holiday_type}`,
  ].join('\n');

  const { data: announcement, error: announcementError } = await supabaseAdmin
    .from('school_announcements')
    .insert({
      school_id: holiday.school_id,
      created_by: null,
      title,
      content,
      priority: HOLIDAY_TYPE_PRIORITY[holiday.holiday_type] ?? 'normal',
      announcement_type: 'holiday',
      event_start: `${holiday.holiday_date}T00:00:00+07:00`,
      event_end: `${holiday.holiday_date}T23:59:59+07:00`,
      is_published: true,
    })
    .select('id')
    .single();
  if (announcementError || !announcement) {
    console.error('Unable to create holiday announcement', announcementError);
    return null;
  }

  const { error: classroomLinkError } = await supabaseAdmin
    .from('announcement_classrooms')
    .insert(
      classroomIds.map((classroomId) => ({
        announcement_id: announcement.id,
        classroom_id: classroomId,
      }))
    );
  if (classroomLinkError) {
    console.error('Unable to link holiday announcement to classrooms', classroomLinkError);
  }

  // A LINE-side failure (bad credentials, API outage, etc.) must not stop
  // the announcement itself from being recorded.
  try {
    const deliveryIds = await queueAnnouncementNotifications({
      schoolId: holiday.school_id,
      announcementId: announcement.id,
      title,
      content,
      imageUrl: null,
      classroomIds,
    });
    if (deliveryIds.length) {
      await processPendingLineNotifications(holiday.school_id, deliveryIds);
    }
  } catch (error) {
    console.error('Unable to send LINE notifications for holiday announcement', error);
  }

  await supabaseAdmin
    .from('school_holidays')
    .update({ announcement_id: announcement.id })
    .eq('id', holiday.id);

  return announcement.id;
}

/**
 * Daily cron: creates announcements for "ตั้งเวลา" (scheduled) holidays whose
 * notice window has opened. "ทันที" (immediate) holidays are announced
 * synchronously when saved instead — see createAnnouncementForHoliday's
 * other caller in the school-holidays API route.
 */
export async function processSchoolHolidayAnnouncements() {
  const today = todayInBangkok();

  const { data: holidays } = await supabaseAdmin
    .from('school_holidays')
    .select('id, school_id, holiday_date, name, holiday_type, notice_days')
    .eq('announce_mode', 'scheduled')
    .is('announcement_id', null)
    .not('notice_days', 'is', null)
    .gte('holiday_date', today);

  const dueHolidays = (holidays ?? []).filter(
    (holiday) => today >= noticeDateFor(holiday.holiday_date, holiday.notice_days!)
  );

  let announcementsCreated = 0;
  for (const holiday of dueHolidays) {
    const announcementId = await createAnnouncementForHoliday(holiday);
    if (announcementId) announcementsCreated += 1;
  }

  return { announcementsCreated };
}
