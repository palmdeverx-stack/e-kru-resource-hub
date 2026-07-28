import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { isDepartmentPermissionKey } from 'src/lib/department-permissions-config';

// ----------------------------------------------------------------------

function parsePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = Array.from(new Set(value.filter((item): item is string => typeof item === 'string')));
  return unique.filter(isDepartmentPermissionKey);
}

export async function GET(request: Request) {
  const caller = requireRole(request, ['school_admin']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('departments')
    .select(
      'id, name, description, created_at, permissions:department_permissions(permission_key), members:department_members(id, role_in_department, teacher:app_users!department_members_teacher_id_fkey(id, first_name, last_name))'
    )
    .eq('school_id', caller.schoolId)
    .order('name');

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const departments = data.map(({ permissions, ...department }) => ({
    ...department,
    permissions: permissions.map((row) => row.permission_key),
  }));

  return NextResponse.json({ departments });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['school_admin']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { name, description, permissions } = await request.json();

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ message: 'กรุณากรอกชื่อฝ่าย' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('departments')
    .select('id')
    .eq('school_id', caller.schoolId)
    .ilike('name', name.trim())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ message: 'มีฝ่ายชื่อนี้อยู่แล้ว' }, { status: 409 });
  }

  const { data: department, error } = await supabaseAdmin
    .from('departments')
    .insert({
      school_id: caller.schoolId,
      name: name.trim(),
      description: typeof description === 'string' && description.trim() ? description.trim() : null,
    })
    .select('id, name, description, created_at')
    .single();

  if (error || !department) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถสร้างฝ่ายได้' },
      { status: 500 }
    );
  }

  const permissionKeys = parsePermissions(permissions);
  if (permissionKeys.length) {
    const { error: permissionError } = await supabaseAdmin
      .from('department_permissions')
      .insert(permissionKeys.map((permission_key) => ({ department_id: department.id, permission_key })));
    if (permissionError) {
      await supabaseAdmin.from('departments').delete().eq('id', department.id);
      return NextResponse.json({ message: permissionError.message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { department: { ...department, permissions: permissionKeys, members: [] } },
    { status: 201 }
  );
}
