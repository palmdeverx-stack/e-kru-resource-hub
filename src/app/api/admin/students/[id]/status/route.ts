import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canManageViaPermission } from 'src/lib/department-permission-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

const VALID_STATUSES = ['studying', 'graduated', 'transferred', 'withdrawn', 'dismissed'] as const;

async function getOwnedStudent(id: string, schoolId: string) {
  return supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('id', id)
    .eq('school_id', schoolId)
    .eq('role', 'student')
    .maybeSingle();
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller?.schoolId || !(await canManageViaPermission(caller, 'students.manage'))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { data: student } = await getOwnedStudent(id, caller.schoolId);
  if (!student) {
    return NextResponse.json({ message: 'ไม่พบนักเรียนในโรงเรียนของคุณ' }, { status: 404 });
  }

  const { status } = await request.json();

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ message: 'สถานะนักเรียนไม่ถูกต้อง' }, { status: 400 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from('app_users')
    .update({
      student_status: status,
      is_active: status === 'studying',
    })
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .eq('role', 'student')
    .select('id, student_status, is_active')
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ student: updated });
}
