'use client';

export type HolidayType = 'regular' | 'urgent' | 'special';
export type HolidayAnnounceMode = 'immediate' | 'scheduled';

export type SchoolHoliday = {
  id: string;
  holiday_date: string;
  name: string;
  holiday_type: HolidayType;
  notice_days: number | null;
  announce_mode: HolidayAnnounceMode;
  announcement_id: string | null;
  created_at: string;
};

export type SaveSchoolHolidayParams = {
  holidayDate: string;
  name: string;
  holidayType: HolidayType;
  announceMode: HolidayAnnounceMode;
  noticeDays?: number | null;
};

export async function listSchoolHolidays(): Promise<SchoolHoliday[]> {
  const response = await fetch('/api/admin/school-holidays', {});
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดวันหยุดได้');
  return json.holidays;
}

export async function createSchoolHoliday(
  params: SaveSchoolHolidayParams
): Promise<SchoolHoliday> {
  const response = await fetch('/api/admin/school-holidays', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถเพิ่มวันหยุดได้');
  return json.holiday;
}

export async function updateSchoolHoliday(
  id: string,
  params: SaveSchoolHolidayParams
): Promise<SchoolHoliday> {
  const response = await fetch(`/api/admin/school-holidays/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถแก้ไขวันหยุดได้');
  return json.holiday;
}

export async function deleteSchoolHoliday(id: string): Promise<void> {
  const response = await fetch(`/api/admin/school-holidays/${id}`, { method: 'DELETE' });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถลบวันหยุดได้');
}
