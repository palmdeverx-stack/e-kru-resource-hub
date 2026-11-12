import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { toPublicUser, verifyAppToken, getRequestToken } from 'src/lib/auth-token';
import { getDepartmentSessionPermissions } from 'src/lib/department-permission-access';

// Session responses must never be shared or reused by a CDN.
export const dynamic = 'force-dynamic';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  const token = getRequestToken(request);
  const payload = token ? verifyAppToken(token) : null;

  if (!payload) {
    return NextResponse.json(
      { message: 'กรุณาเข้าสู่ระบบ' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  const userQuery =
    payload.role === 'marketplace_user'
      ? supabaseAdmin.from('marketplace_users').select('*').eq('id', payload.sub).single()
      : supabaseAdmin.from('app_users').select('*').eq('id', payload.sub).single();
  const { data: user } = await userQuery;

  const studentCannotAccess =
    user?.role === 'student' && (user.student_status ?? 'studying') !== 'studying';

  const tokenAccountMatches =
    user &&
    Number(user.session_version ?? 0) === Number(payload.sessionVersion ?? 0) &&
    (payload.role === 'marketplace_user' ||
      (user.role === payload.role && (user.school_id ?? null) === payload.schoolId));

  if (
    !tokenAccountMatches ||
    user.is_suspended === true ||
    user.is_active === false ||
    studentCannotAccess
  ) {
    return NextResponse.json(
      { message: 'กรุณาเข้าสู่ระบบ' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  let departments: { id: string; name: string; role_in_department: 'head' | 'member' }[] = [];
  let departmentPermissions: string[] = [];
  let managePermissions: string[] = [];
  if (user.role === 'teacher') {
    const [{ data: membership }, permissions] = await Promise.all([
      supabaseAdmin
        .from('department_members')
        .select('role_in_department, department:departments(id, name)')
        .eq('teacher_id', user.id),
      user.school_id
        ? getDepartmentSessionPermissions(user.id, user.school_id)
        : Promise.resolve({ view: [], manage: [] }),
    ]);
    departmentPermissions = permissions.view;
    managePermissions = permissions.manage;
    departments = (membership ?? []).map((row) => ({
      id: (row.department as unknown as { id: string; name: string }).id,
      name: (row.department as unknown as { id: string; name: string }).name,
      role_in_department: row.role_in_department as 'head' | 'member',
    }));
  }

  return NextResponse.json(
    {
      user: {
        ...toPublicUser(user),
        school_id: user.school_id ?? null,
        access_scope: payload.accessScope ?? 'full',
        departments,
        department_permissions: departmentPermissions,
        manage_permissions: managePermissions,
      },
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
