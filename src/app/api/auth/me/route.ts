import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { toPublicUser, verifyAppToken, getRequestToken } from 'src/lib/auth-token';
import {
  getDepartmentGrantedPermissions,
  getEffectiveDepartmentPermissions,
} from 'src/lib/department-permission-access';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  const token = getRequestToken(request);
  const payload = token ? verifyAppToken(token) : null;

  if (!payload) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const userQuery =
    payload.role === 'marketplace_user'
      ? supabaseAdmin.from('marketplace_users').select('*').eq('id', payload.sub).single()
      : supabaseAdmin.from('app_users').select('*').eq('id', payload.sub).single();
  const { data: user } = await userQuery;

  const studentCannotAccess =
    user?.role === 'student' && (user.student_status ?? 'studying') !== 'studying';

  if (!user || user.is_active === false || studentCannotAccess) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  let departments: { id: string; name: string; role_in_department: 'head' | 'member' }[] = [];
  let departmentPermissions: string[] = [];
  let managePermissions: string[] = [];
  if (user.role === 'teacher') {
    const { data: membership } = await supabaseAdmin
      .from('department_members')
      .select('role_in_department, department:departments(id, name)')
      .eq('teacher_id', user.id);
    departments = (membership ?? []).map((row) => ({
      id: (row.department as unknown as { id: string; name: string }).id,
      name: (row.department as unknown as { id: string; name: string }).name,
      role_in_department: row.role_in_department as 'head' | 'member',
    }));
    if (user.school_id) {
      // View and manage levels combine department grants, staff-type presets,
      // and per-person overrides. Writes are still checked server-side.
      [departmentPermissions, managePermissions] = await Promise.all([
        getDepartmentGrantedPermissions(user.id, user.school_id),
        getEffectiveDepartmentPermissions(user.id, user.school_id),
      ]);
    }
  }

  return NextResponse.json({
    user: {
      ...toPublicUser(user),
      school_id: user.school_id ?? null,
      departments,
      department_permissions: departmentPermissions,
      manage_permissions: managePermissions,
    },
  });
}
