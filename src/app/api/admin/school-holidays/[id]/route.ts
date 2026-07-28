import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { createAnnouncementForHoliday } from 'src/lib/school-holiday-announcements';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

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

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
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

  const { data: existing } = await supabaseAdmin
    .from('school_holidays')
    .select('holiday_date, notice_days, announce_mode')
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ message: 'ไม่พบวันหยุดนี้' }, { status: 404 });

  // The date, notice window, or announce mode shifted, so any announcement
  // already created for the old schedule is now stale — clear the link and
  // let it be re-announced under the new schedule (the old post itself is
  // left alone; admin can remove it manually from the announcements page).
  const scheduleChanged =
    existing.holiday_date !== holidayDate ||
    existing.notice_days !== parsedNoticeDays ||
    existing.announce_mode !== resolvedAnnounceMode;

  const { data: holiday, error } = await supabaseAdmin
    .from('school_holidays')
    .update({
      holiday_date: holidayDate,
      name: name.trim(),
      holiday_type: holidayType ?? 'regular',
      notice_days: parsedNoticeDays,
      announce_mode: resolvedAnnounceMode,
      ...(scheduleChanged && { announcement_id: null }),
    })
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .select(HOLIDAY_SELECT)
    .single();

  if (error || !holiday) {
    if (error?.code === '23505') {
      return NextResponse.json({ message: 'มีวันหยุดในวันที่นี้อยู่แล้ว' }, { status: 409 });
    }
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถแก้ไขวันหยุดได้' },
      { status: 500 }
    );
  }

  if (resolvedAnnounceMode === 'immediate' && !holiday.announcement_id) {
    const announcementId = await createAnnouncementForHoliday({
      id: holiday.id,
      school_id: caller.schoolId,
      holiday_date: holiday.holiday_date,
      name: holiday.name,
      holiday_type: holiday.holiday_type,
    });
    if (announcementId) holiday.announcement_id = announcementId;
  }

  return NextResponse.json({ holiday });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('school_holidays')
    .delete()
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'ไม่พบวันหยุดนี้' }, { status: 404 });

  return NextResponse.json({ success: true });
}
