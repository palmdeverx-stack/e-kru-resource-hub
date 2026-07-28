import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { getTeacherDashboardSummaryData } from 'src/lib/teacher-dashboard-data';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  const caller = requireRole(request, ['teacher']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  try {
    const data = await getTeacherDashboardSummaryData(caller.sub, caller.schoolId);
    if (!data) {
      return NextResponse.json({ message: 'ไม่พบข้อมูลครูผู้สอน' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลแดชบอร์ดได้' },
      { status: 500 }
    );
  }
}
