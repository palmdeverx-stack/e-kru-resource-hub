import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  const caller = requireRole(request, ['teacher']);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { data: membership } = await supabaseAdmin
    .from('department_members')
    .select('role_in_department, department:departments(id, name, description)')
    .eq('teacher_id', caller.sub)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ department: null, roleInDepartment: null, members: [] });
  }

  const department = membership.department as unknown as {
    id: string;
    name: string;
    description: string | null;
  };

  const { data: members, error } = await supabaseAdmin
    .from('department_members')
    .select(
      'id, role_in_department, teacher:app_users!department_members_teacher_id_fkey(id, first_name, last_name, avatar_url)'
    )
    .eq('department_id', department.id);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({
    department,
    roleInDepartment: membership.role_in_department,
    members,
  });
}
