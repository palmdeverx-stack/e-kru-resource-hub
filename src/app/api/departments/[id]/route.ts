import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import {
  isDepartmentPermissionKey,
  isDepartmentDelegablePermission,
} from 'src/lib/department-permissions-config';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

function parsePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = Array.from(new Set(value.filter((item): item is string => typeof item === 'string')));
  return unique
    .filter(isDepartmentPermissionKey)
    .filter(isDepartmentDelegablePermission);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin']);

  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { id } = await params;
  const { name, description, permissions } = await request.json();

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ message: 'กรุณากรอกชื่อฝ่าย' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('departments')
    .select('id')
    .eq('school_id', caller.schoolId)
    .neq('id', id)
    .ilike('name', name.trim())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ message: 'มีฝ่ายชื่อนี้อยู่แล้ว' }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from('departments')
    .update({
      name: name.trim(),
      description: typeof description === 'string' && description.trim() ? description.trim() : null,
    })
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .select('id, name, description, created_at')
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'ไม่พบฝ่ายนี้' }, { status: 404 });

  // `permissions` is only touched when the caller explicitly sends it (the
  // dedicated "จัดการสิทธิ์เข้าใช้งาน" page) — a plain name/description edit
  // must not silently wipe out the department's granted permissions.
  if (permissions === undefined) {
    const { data: currentPermissions } = await supabaseAdmin
      .from('department_permissions')
      .select('permission_key')
      .eq('department_id', id);
    return NextResponse.json({
      department: {
        ...data,
        permissions: (currentPermissions ?? []).map((row) => row.permission_key),
      },
    });
  }

  const permissionKeys = parsePermissions(permissions);

  const { error: deleteError } = await supabaseAdmin
    .from('department_permissions')
    .delete()
    .eq('department_id', id);
  if (deleteError) return NextResponse.json({ message: deleteError.message }, { status: 500 });

  if (permissionKeys.length) {
    const { error: insertError } = await supabaseAdmin
      .from('department_permissions')
      .insert(permissionKeys.map((permission_key) => ({ department_id: id, permission_key })));
    if (insertError) return NextResponse.json({ message: insertError.message }, { status: 500 });
  }

  // A permission revoked at the department level should also stop being
  // effective for members — drop any member grants that are no longer covered.
  const { data: members } = await supabaseAdmin
    .from('department_members')
    .select('id')
    .eq('department_id', id);
  const memberIds = (members ?? []).map((member) => member.id);
  if (memberIds.length) {
    let cleanupQuery = supabaseAdmin
      .from('department_member_permissions')
      .delete()
      .in('member_id', memberIds);
    cleanupQuery = permissionKeys.length
      ? cleanupQuery.not('permission_key', 'in', `(${permissionKeys.join(',')})`)
      : cleanupQuery;
    await cleanupQuery;
  }

  return NextResponse.json({ department: { ...data, permissions: permissionKeys } });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin']);

  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('departments')
    .delete()
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'ไม่พบฝ่ายนี้' }, { status: 404 });

  return NextResponse.json({ success: true });
}
