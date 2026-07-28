import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canViewViaPermission } from 'src/lib/department-permission-access';
import { canApproveSchedule, hasTimetableCapability } from 'src/lib/schedule-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  const canView =
    !!caller?.schoolId &&
    ((await canApproveSchedule(caller)) ||
      (await canViewViaPermission(caller, 'schedule.approve')) ||
      (caller.role === 'teacher' && (await hasTimetableCapability(caller.sub, caller.schoolId))));
  if (!caller?.schoolId || !canView) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('classroom_schedule_approvals')
    .select(
      'id, status, submitted_at, approved_at, canceled_at, signature_url, signature_signed_at, submitter_signature_url, submitter_signature_signed_at, classroom:classrooms(id, name, grade_level, homeroom_teachers:classroom_homeroom_teachers(teacher:app_users(id, first_name, last_name))), semester:semesters(id, name, academic_year:academic_years(year)), submitted_by:app_users!classroom_schedule_approvals_submitted_by_fkey(first_name, last_name, position_title), approved_by:app_users!classroom_schedule_approvals_approved_by_fkey(first_name, last_name, position_title), canceled_by:app_users!classroom_schedule_approvals_canceled_by_fkey(first_name, last_name, position_title)'
    )
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'ไม่พบรายการอนุมัตินี้' }, { status: 404 });

  return NextResponse.json({ approval: data });
}
