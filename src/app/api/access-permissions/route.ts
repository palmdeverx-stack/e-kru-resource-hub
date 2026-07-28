import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import {
  isDepartmentPermissionKey,
  isManageableDepartmentPermission,
} from 'src/lib/department-permissions-config';

// ----------------------------------------------------------------------

type AccessLevel = 'none' | 'view' | 'manage';

const ACCESS_LEVELS = ['none', 'view', 'manage'];
function parsePermissions(value: unknown, allowInherit = false) {
  if (!Array.isArray(value)) return null;

  const permissions: { key: string; level: AccessLevel }[] = [];
  for (const item of value) {
    if (
      !item ||
      typeof item.key !== 'string' ||
      !isDepartmentPermissionKey(item.key) ||
      typeof item.level !== 'string' ||
      (!ACCESS_LEVELS.includes(item.level) && !(allowInherit && item.level === 'inherit'))
    ) {
      return null;
    }
    if (item.level === 'inherit') continue;
    if (!isManageableDepartmentPermission(item.key) && item.level === 'manage') {
      return null;
    }
    permissions.push({ key: item.key, level: item.level as AccessLevel });
  }
  return permissions;
}

export async function GET(request: Request) {
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const [
    { data: staffTypePermissions, error: typeError },
    { data: staff, error: staffError },
    { data: staffTypes, error: staffTypesError },
  ] = await Promise.all([
      supabaseAdmin
        .from('staff_type_permissions')
        .select('staff_type, permission_key, access_level')
        .eq('school_id', caller.schoolId),
      supabaseAdmin
        .from('app_users')
        .select(
          'id, username, first_name, last_name, staff_type, overrides:staff_permission_overrides(permission_key, access_level)'
        )
        .eq('school_id', caller.schoolId)
        .eq('role', 'teacher')
        .order('first_name'),
      supabaseAdmin
        .from('staff_master_items')
        .select('code, name, name_en, is_active')
        .eq('school_id', caller.schoolId)
        .eq('category', 'staff_type')
        .order('sort_order')
        .order('name'),
    ]);

  if (typeError || staffError || staffTypesError) {
    return NextResponse.json(
      {
        message:
          typeError?.message ??
          staffError?.message ??
          staffTypesError?.message ??
          'ไม่สามารถโหลดสิทธิ์ได้',
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ staffTypePermissions, staff, staffTypes });
}

export async function PATCH(request: Request) {
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const scope = body?.scope;
  const permissions = parsePermissions(body?.permissions, scope === 'user');

  if (!permissions || (scope !== 'staff_type' && scope !== 'user')) {
    return NextResponse.json(
      { message: 'ข้อมูลสิทธิ์ไม่ถูกต้อง หรือมีสิทธิ์ที่สงวนไว้เฉพาะผู้ดูแลโรงเรียน' },
      { status: 400 }
    );
  }

  if (scope === 'staff_type') {
    const staffType = body?.staffType;
    const { data: staffTypeItem } =
      typeof staffType === 'string'
        ? await supabaseAdmin
            .from('staff_master_items')
            .select('id')
            .eq('school_id', caller.schoolId)
            .eq('category', 'staff_type')
            .eq('code', staffType)
            .eq('is_active', true)
            .maybeSingle()
        : { data: null };
    if (!staffTypeItem) {
      return NextResponse.json({ message: 'ประเภทบุคลากรไม่ถูกต้อง' }, { status: 400 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('staff_type_permissions')
      .delete()
      .eq('school_id', caller.schoolId)
      .eq('staff_type', staffType);
    if (deleteError) {
      return NextResponse.json({ message: deleteError.message }, { status: 500 });
    }

    const rows = permissions
      .filter((permission) => permission.level !== 'none')
      .map((permission) => ({
        school_id: caller.schoolId,
        staff_type: staffType,
        permission_key: permission.key,
        access_level: permission.level,
      }));
    if (rows.length) {
      const { error } = await supabaseAdmin.from('staff_type_permissions').insert(rows);
      if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    }
  } else {
    const userId = typeof body?.userId === 'string' ? body.userId : '';
    const { data: staffUser } = await supabaseAdmin
      .from('app_users')
      .select('id, staff_type')
      .eq('id', userId)
      .eq('school_id', caller.schoolId)
      .eq('role', 'teacher')
      .maybeSingle();

    if (!staffUser) {
      return NextResponse.json({ message: 'ไม่พบบุคลากรที่เลือก' }, { status: 404 });
    }
    const { error: deleteError } = await supabaseAdmin
      .from('staff_permission_overrides')
      .delete()
      .eq('school_id', caller.schoolId)
      .eq('user_id', userId);

    if (deleteError) {
      return NextResponse.json({ message: deleteError.message }, { status: 500 });
    }

    const rows = permissions.map((permission) => ({
      school_id: caller.schoolId,
      user_id: userId,
      permission_key: permission.key,
      access_level: permission.level,
    }));
    if (rows.length) {
      const { error } = await supabaseAdmin.from('staff_permission_overrides').insert(rows);
      if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
