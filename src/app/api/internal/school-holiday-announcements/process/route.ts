import { NextResponse } from 'next/server';

import { isValidCronSecret } from 'src/lib/cron-auth';
import { processSchoolHolidayAnnouncements } from 'src/lib/school-holiday-announcements';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  if (!isValidCronSecret(request)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 401 });
  }

  const result = await processSchoolHolidayAnnouncements();
  return NextResponse.json(result);
}
