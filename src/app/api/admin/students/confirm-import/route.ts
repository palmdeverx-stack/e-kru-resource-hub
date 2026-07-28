import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canManageViaPermission } from 'src/lib/department-permission-access';

// ----------------------------------------------------------------------

export async function POST(request: Request) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller?.schoolId || !(await canManageViaPermission(caller, 'students.manage'))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { ids } = await request.json();

  if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ message: 'กรุณาเลือกนักเรียนที่จะยืนยัน' }, { status: 400 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from('app_users')
    .update({ import_confirmed_at: new Date().toISOString() })
    .in('id', ids)
    .eq('school_id', caller.schoolId)
    .eq('role', 'student')
    .select('id');

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ confirmedCount: updated?.length ?? 0 });
}
