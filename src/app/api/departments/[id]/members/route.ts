import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import {
  isDepartmentPermissionKey,
  isManageableDepartmentPermission,
} from 'src/lib/department-permissions-config';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };
type Caller = { sub: string; role: string; schoolId: string | null };

async function canManageDepartment(caller: Caller, departmentId: string) {
  if (caller.role === 'school_admin') return true;

  const { data } = await supabaseAdmin
    .from('department_members')
    .select('role_in_department')
    .eq('department_id', departmentId)
    .eq('teacher_id', caller.sub)
    .maybeSingle();

  return data?.role_in_department === 'head';
}

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller?.schoolId) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { id } = await params;
  const { data: department } = await supabaseAdmin
    .from('departments')
    .select('id, name, permissions:department_permissions(permission_key)')
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .maybeSingle();
  if (!department) return NextResponse.json({ message: 'ไม่พบฝ่ายนี้' }, { status: 404 });

  if (!(await canManageDepartment(caller, id))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const [
    { data: members, error: membersError },
    { data: allTeachers, error: teachersError },
    { data: allAssigned, error: assignedError },
  ] = await Promise.all([
    supabaseAdmin
      .from('department_members')
      .select(
        'id, role_in_department, permissions:department_member_permissions(permission_key), teacher:app_users!department_members_teacher_id_fkey(id, first_name, last_name, avatar_url)'
      )
      .eq('department_id', id),
    supabaseAdmin
      .from('app_users')
      .select('id, first_name, last_name')
      .eq('school_id', caller.schoolId)
      .eq('role', 'teacher')
      .order('first_name'),
    supabaseAdmin.from('department_members').select('teacher_id'),
  ]);

  if (membersError) return NextResponse.json({ message: membersError.message }, { status: 500 });
  if (teachersError) return NextResponse.json({ message: teachersError.message }, { status: 500 });
  if (assignedError) return NextResponse.json({ message: assignedError.message }, { status: 500 });

  const assignedIds = new Set((allAssigned ?? []).map((row) => row.teacher_id));
  const eligibleTeachers = (allTeachers ?? []).filter((teacher) => !assignedIds.has(teacher.id));

  return NextResponse.json({
    department: {
      ...department,
      permissions: department.permissions.map((row) => row.permission_key),
    },
    members: (members ?? []).map(({ permissions, ...member }) => ({
      ...member,
      permissions: permissions.map((row) => row.permission_key),
    })),
    eligibleTeachers,
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller?.schoolId) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { id } = await params;
  const { data: department } = await supabaseAdmin
    .from('departments')
    .select('id')
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .maybeSingle();
  if (!department) return NextResponse.json({ message: 'ไม่พบฝ่ายนี้' }, { status: 404 });

  if (!(await canManageDepartment(caller, id))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { teacherId, roleInDepartment } = await request.json();

  if (typeof teacherId !== 'string' || !teacherId) {
    return NextResponse.json({ message: 'กรุณาเลือกครู' }, { status: 400 });
  }
  if (roleInDepartment !== 'head' && roleInDepartment !== 'member') {
    return NextResponse.json({ message: 'บทบาทในฝ่ายไม่ถูกต้อง' }, { status: 400 });
  }

  const { data: teacher } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('id', teacherId)
    .eq('school_id', caller.schoolId)
    .eq('role', 'teacher')
    .maybeSingle();
  if (!teacher) {
    return NextResponse.json({ message: 'ไม่พบครูคนนี้ในโรงเรียนของคุณ' }, { status: 404 });
  }

  const { data: alreadyMember } = await supabaseAdmin
    .from('department_members')
    .select('department_id')
    .eq('teacher_id', teacherId)
    .maybeSingle();
  if (alreadyMember) {
    return NextResponse.json({ message: 'ครูคนนี้สังกัดฝ่ายอื่นอยู่แล้ว' }, { status: 409 });
  }

  const { data: member, error } = await supabaseAdmin
    .from('department_members')
    .insert({ department_id: id, teacher_id: teacherId, role_in_department: roleInDepartment })
    .select(
      'id, role_in_department, teacher:app_users!department_members_teacher_id_fkey(id, first_name, last_name, avatar_url)'
    )
    .single();

  if (error || !member) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถเพิ่มสมาชิกได้' },
      { status: 500 }
    );
  }

  return NextResponse.json({ member: { ...member, permissions: [] } }, { status: 201 });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller?.schoolId) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { id } = await params;
  const { data: department } = await supabaseAdmin
    .from('departments')
    .select('id')
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .maybeSingle();
  if (!department) return NextResponse.json({ message: 'ไม่พบฝ่ายนี้' }, { status: 404 });

  if (!(await canManageDepartment(caller, id))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { memberId, roleInDepartment, permissionKey, granted } = await request.json();
  if (typeof memberId !== 'string' || !memberId) {
    return NextResponse.json({ message: 'ไม่พบสมาชิกที่ต้องการแก้ไข' }, { status: 400 });
  }

  if (roleInDepartment !== undefined) {
    if (roleInDepartment !== 'head' && roleInDepartment !== 'member') {
      return NextResponse.json({ message: 'บทบาทในฝ่ายไม่ถูกต้อง' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('department_members')
      .update({ role_in_department: roleInDepartment })
      .eq('id', memberId)
      .eq('department_id', id)
      .select(
        'id, role_in_department, permissions:department_member_permissions(permission_key), teacher:app_users!department_members_teacher_id_fkey(id, first_name, last_name, avatar_url)'
      )
      .maybeSingle();

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ message: 'ไม่พบสมาชิกนี้' }, { status: 404 });

    return NextResponse.json({
      member: { ...data, permissions: data.permissions.map((row) => row.permission_key) },
    });
  }

  if (typeof permissionKey === 'string' && typeof granted === 'boolean') {
    if (!isDepartmentPermissionKey(permissionKey)) {
      return NextResponse.json({ message: 'สิทธิ์ไม่ถูกต้อง' }, { status: 400 });
    }
    if (!isManageableDepartmentPermission(permissionKey)) {
      return NextResponse.json(
        { message: 'สิทธิ์นี้เป็นแบบดูข้อมูลเท่านั้น' },
        { status: 400 }
      );
    }

    const { data: member } = await supabaseAdmin
      .from('department_members')
      .select('id')
      .eq('id', memberId)
      .eq('department_id', id)
      .maybeSingle();
    if (!member) return NextResponse.json({ message: 'ไม่พบสมาชิกนี้' }, { status: 404 });

    if (granted) {
      const { data: departmentGrant } = await supabaseAdmin
        .from('department_permissions')
        .select('id')
        .eq('department_id', id)
        .eq('permission_key', permissionKey)
        .maybeSingle();
      if (!departmentGrant) {
        return NextResponse.json({ message: 'ฝ่ายนี้ยังไม่ได้เปิดสิทธิ์นี้' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('department_member_permissions')
        .upsert(
          { member_id: memberId, permission_key: permissionKey },
          { onConflict: 'member_id,permission_key' }
        );
      if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    } else {
      const { error } = await supabaseAdmin
        .from('department_member_permissions')
        .delete()
        .eq('member_id', memberId)
        .eq('permission_key', permissionKey);
      if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const { data, error: reloadError } = await supabaseAdmin
      .from('department_members')
      .select(
        'id, role_in_department, permissions:department_member_permissions(permission_key), teacher:app_users!department_members_teacher_id_fkey(id, first_name, last_name, avatar_url)'
      )
      .eq('id', memberId)
      .single();
    if (reloadError) return NextResponse.json({ message: reloadError.message }, { status: 500 });

    return NextResponse.json({
      member: { ...data, permissions: data.permissions.map((row) => row.permission_key) },
    });
  }

  return NextResponse.json({ message: 'ไม่มีข้อมูลที่ต้องการแก้ไข' }, { status: 400 });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller?.schoolId) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { id } = await params;
  const { data: department } = await supabaseAdmin
    .from('departments')
    .select('id')
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .maybeSingle();
  if (!department) return NextResponse.json({ message: 'ไม่พบฝ่ายนี้' }, { status: 404 });

  if (!(await canManageDepartment(caller, id))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('memberId');
  if (!memberId) return NextResponse.json({ message: 'ไม่พบสมาชิกที่ต้องการลบ' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('department_members')
    .delete()
    .eq('id', memberId)
    .eq('department_id', id)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'ไม่พบสมาชิกนี้' }, { status: 404 });

  return NextResponse.json({ success: true });
}
