import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { canViewTeacherDashboard } from 'src/lib/teacher-dashboard-access';
import { getTeacherDashboardSummaryData } from 'src/lib/teacher-dashboard-data';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { id } = await params;

  if (!(await canViewTeacherDashboard(caller, id))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  try {
    const data = await getTeacherDashboardSummaryData(id, caller.schoolId);
    if (!data) {
      return NextResponse.json({ message: 'ไม่พบข้อมูลครูผู้สอน' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลการสอนได้' },
      { status: 500 }
    );
  }
}
