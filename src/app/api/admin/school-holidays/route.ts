import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { createAnnouncementForHoliday } from 'src/lib/school-holiday-announcements';

// ----------------------------------------------------------------------

const HOLIDAY_TYPES = ['regular', 'urgent', 'special'] as const;
const ANNOUNCE_MODES = ['immediate', 'scheduled'] as const;

function isHolidayType(value: unknown): value is (typeof HOLIDAY_TYPES)[number] {
  return typeof value === 'string' && HOLIDAY_TYPES.includes(value as never);
}

function isAnnounceMode(value: unknown): value is (typeof ANNOUNCE_MODES)[number] {
  return typeof value === 'string' && ANNOUNCE_MODES.includes(value as never);
}

const HOLIDAY_SELECT =
  'id, holiday_date, name, holiday_type, notice_days, announce_mode, announcement_id, created_at';

export async function GET(request: Request) {
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('school_holidays')
    .select(HOLIDAY_SELECT)
    .eq('school_id', caller.schoolId)
    .order('holiday_date');

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ holidays: data });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { holidayDate, name, holidayType, noticeDays, announceMode } = await request.json();
  if (typeof holidayDate !== 'string' || !holidayDate || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ message: 'กรุณาระบุวันที่และชื่อวันหยุด' }, { status: 400 });
  }
  if (holidayType !== undefined && !isHolidayType(holidayType)) {
    return NextResponse.json({ message: 'ประเภทวันหยุดไม่ถูกต้อง' }, { status: 400 });
  }
  if (announceMode !== undefined && !isAnnounceMode(announceMode)) {
    return NextResponse.json({ message: 'รูปแบบเวลาการประกาศไม่ถูกต้อง' }, { status: 400 });
  }
  const resolvedAnnounceMode = announceMode ?? 'scheduled';
  const parsedNoticeDays =
    resolvedAnnounceMode === 'immediate' || noticeDays === null || noticeDays === undefined
      ? null
      : Number(noticeDays);
  if (parsedNoticeDays !== null && (!Number.isInteger(parsedNoticeDays) || parsedNoticeDays < 0)) {
    return NextResponse.json({ message: 'จำนวนวันแจ้งล่วงหน้าไม่ถูกต้อง' }, { status: 400 });
  }

  const { data: holiday, error } = await supabaseAdmin
    .from('school_holidays')
    .insert({
      school_id: caller.schoolId,
      holiday_date: holidayDate,
      name: name.trim(),
      holiday_type: holidayType ?? 'regular',
      notice_days: parsedNoticeDays,
      announce_mode: resolvedAnnounceMode,
    })
    .select(HOLIDAY_SELECT)
    .single();

  if (error || !holiday) {
    if (error?.code === '23505') {
      return NextResponse.json({ message: 'มีวันหยุดในวันที่นี้อยู่แล้ว' }, { status: 409 });
    }
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถเพิ่มวันหยุดได้' },
      { status: 500 }
    );
  }

  if (resolvedAnnounceMode === 'immediate') {
    const announcementId = await createAnnouncementForHoliday({
      id: holiday.id,
      school_id: caller.schoolId,
      holiday_date: holiday.holiday_date,
      name: holiday.name,
      holiday_type: holiday.holiday_type,
    });
    if (announcementId) holiday.announcement_id = announcementId;
  }

  return NextResponse.json({ holiday }, { status: 201 });
}
