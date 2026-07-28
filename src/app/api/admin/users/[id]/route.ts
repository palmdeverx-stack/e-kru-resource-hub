import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { encryptCredential } from 'src/lib/credential-cipher';
import { isActiveStaffMasterValue } from 'src/lib/staff-master';
import { syncLinkedStaffAuth } from 'src/lib/staff-supabase-auth';
import { checkSchoolSeatLimit } from 'src/lib/school-subscription';
import {
  hasDepartmentPermission,
  getDepartmentGrantedPermissions,
} from 'src/lib/department-permission-access';

import { isStaffType, isEmploymentStatus } from 'src/types/staff-employment';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

const USER_SELECT =
  'id, username, email, name_prefix, first_name, last_name, first_name_en, last_name_en, avatar_url, role, school_id, school:schools!app_users_school_id_fkey(name), created_at, must_change_password, student_status, is_active, is_school_director, staff_type, employment_status, employment_start_date, appointment_date, contract_end_date, position_title, academic_rank, line_linked_at, line_display_name, auth_user_id, auth_login_email, auth_role, auth_migrated_at';

async function getManagedUser(id: string) {
  return supabaseAdmin.from('app_users').select(USER_SELECT).eq('id', id).maybeSingle();
}

const TARGET_PERMISSION: Record<string, 'staff.manage' | 'students.manage'> = {
  teacher: 'staff.manage',
  student: 'students.manage',
};

async function canView(
  caller: { role: string; sub: string; schoolId: string | null },
  target: { role: string; school_id: string | null }
): Promise<boolean> {
  if (caller.role === 'master_admin') return target.role === 'school_admin';
  if (caller.role === 'school_admin') {
    return (
      caller.schoolId === target.school_id &&
      (target.role === 'teacher' || target.role === 'student')
    );
  }
  if (caller.role !== 'teacher' || !caller.schoolId || caller.schoolId !== target.school_id) {
    return false;
  }
  const permissionKey = TARGET_PERMISSION[target.role];
  if (!permissionKey) return false;
  const granted = await getDepartmentGrantedPermissions(caller.sub, caller.schoolId);
  return granted.includes(permissionKey);
}

async function canManage(
  caller: { role: string; sub: string; schoolId: string | null },
  target: { role: string; school_id: string | null }
): Promise<boolean> {
  if (caller.role === 'master_admin') return target.role === 'school_admin';
  if (caller.role === 'school_admin') {
    return (
      caller.schoolId === target.school_id &&
      (target.role === 'teacher' || target.role === 'student')
    );
  }
  if (caller.role !== 'teacher' || !caller.schoolId || caller.schoolId !== target.school_id) {
    return false;
  }
  const permissionKey = TARGET_PERMISSION[target.role];
  if (!permissionKey) return false;
  return hasDepartmentPermission(caller.sub, caller.schoolId, permissionKey);
}

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['master_admin', 'school_admin', 'teacher']);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { id } = await params;
  const { data: user, error } = await getManagedUser(id);
  if (error || !user || !(await canView(caller, user))) {
    return NextResponse.json({ message: 'ไม่พบบัญชีหรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['master_admin', 'school_admin', 'teacher']);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { id } = await params;
  const { data: target } = await getManagedUser(id);
  if (!target || !(await canManage(caller, target))) {
    return NextResponse.json({ message: 'ไม่พบบัญชีหรือไม่มีสิทธิ์จัดการ' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);

  if (body?.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({ message: 'สถานะบัญชีไม่ถูกต้อง' }, { status: 400 });
    }
    if (
      body.isActive &&
      target.role === 'student' &&
      (target.student_status ?? 'studying') !== 'studying'
    ) {
      return NextResponse.json(
        { message: 'ต้องเปลี่ยนสถานะนักเรียนเป็น “กำลังศึกษา” ก่อนเปิดใช้งานบัญชี' },
        { status: 409 }
      );
    }
    if (body.isActive && !target.is_active && target.school_id) {
      const seat = await checkSchoolSeatLimit(
        target.school_id,
        target.role as 'school_admin' | 'teacher' | 'student'
      );
      if (!seat.allowed) {
        return NextResponse.json({ message: seat.message }, { status: 409 });
      }
    }

    if (target.role !== 'student') {
      const authResult = await syncLinkedStaffAuth(target, { isActive: body.isActive });
      if (!authResult.ok) {
        return NextResponse.json(
          { message: `ไม่สามารถอัปเดตสถานะ Supabase Auth ได้: ${authResult.message}` },
          { status: 500 }
        );
      }
    }

    const { data: user, error } = await supabaseAdmin
      .from('app_users')
      .update({ is_active: body.isActive })
      .eq('id', id)
      .select(USER_SELECT)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { message: error?.message ?? 'ไม่สามารถเปลี่ยนสถานะบัญชีได้' },
        { status: 500 }
      );
    }
    return NextResponse.json({ user });
  }

  if (body?.isSchoolDirector !== undefined) {
    if (typeof body.isSchoolDirector !== 'boolean') {
      return NextResponse.json({ message: 'ค่าไม่ถูกต้อง' }, { status: 400 });
    }
    if (caller.role !== 'school_admin' || target.role !== 'teacher') {
      return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const { data: user, error } = await supabaseAdmin
      .from('app_users')
      .update({
        is_school_director: body.isSchoolDirector,
        staff_type: body.isSchoolDirector
          ? 'executive'
          : target.staff_type === 'executive'
            ? 'teacher'
            : target.staff_type,
      })
      .eq('id', id)
      .select(USER_SELECT)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { message: error?.message ?? 'ไม่สามารถเปลี่ยนสิทธิ์ผู้อำนวยการได้' },
        { status: 500 }
      );
    }
    return NextResponse.json({ user });
  }

  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const namePrefix = typeof body?.namePrefix === 'string' ? body.namePrefix.trim() : '';
  const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : '';
  const firstNameEn = typeof body?.firstNameEn === 'string' ? body.firstNameEn.trim() : '';
  const lastNameEn = typeof body?.lastNameEn === 'string' ? body.lastNameEn.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const staffType = body?.staffType;
  const employmentStatus = body?.employmentStatus;
  const employmentStartDate =
    typeof body?.employmentStartDate === 'string' ? body.employmentStartDate : '';
  const appointmentDate = typeof body?.appointmentDate === 'string' ? body.appointmentDate : '';
  const contractEndDate = typeof body?.contractEndDate === 'string' ? body.contractEndDate : '';
  const positionTitle = typeof body?.positionTitle === 'string' ? body.positionTitle.trim() : '';
  const academicRank = typeof body?.academicRank === 'string' ? body.academicRank.trim() : '';
  const schoolId =
    caller.role === 'master_admin' && typeof body?.schoolId === 'string'
      ? body.schoolId
      : target.school_id;

  if (!username || !firstName || !lastName || !schoolId) {
    return NextResponse.json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
  }
  if (password && password.length < 6) {
    return NextResponse.json({ message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 400 });
  }
  if (target.role === 'teacher' && !isStaffType(staffType)) {
    return NextResponse.json({ message: 'กรุณาเลือกประเภทบุคลากร' }, { status: 400 });
  }
  if (target.role === 'teacher' && !isEmploymentStatus(employmentStatus)) {
    return NextResponse.json({ message: 'กรุณาเลือกสถานะการทำงาน' }, { status: 400 });
  }
  const employmentDates = [employmentStartDate, appointmentDate, contractEndDate].filter(Boolean);
  if (employmentDates.some((date) => Number.isNaN(Date.parse(date)))) {
    return NextResponse.json({ message: 'วันที่ในข้อมูลการทำงานไม่ถูกต้อง' }, { status: 400 });
  }
  if (employmentStartDate && contractEndDate && contractEndDate < employmentStartDate) {
    return NextResponse.json(
      { message: 'วันที่สิ้นสุดสัญญาต้องไม่ก่อนวันที่เริ่มงาน' },
      { status: 400 }
    );
  }

  const [{ data: duplicate }, { data: school }] = await Promise.all([
    supabaseAdmin
      .from('app_users')
      .select('id')
      .ilike('username', username)
      .neq('id', id)
      .maybeSingle(),
    supabaseAdmin.from('schools').select('id').eq('id', schoolId).maybeSingle(),
  ]);

  if (duplicate) {
    return NextResponse.json({ message: 'ชื่อผู้ใช้งานนี้ถูกใช้แล้ว' }, { status: 409 });
  }
  if (!school) {
    return NextResponse.json({ message: 'ไม่พบโรงเรียนที่เลือก' }, { status: 400 });
  }
  if (
    target.role === 'teacher' &&
    (!(await isActiveStaffMasterValue(schoolId, 'staff_type', staffType)) ||
      !namePrefix ||
      !(await isActiveStaffMasterValue(schoolId, 'prefix', namePrefix)) ||
      (positionTitle && !(await isActiveStaffMasterValue(schoolId, 'position', positionTitle))) ||
      (academicRank && !(await isActiveStaffMasterValue(schoolId, 'academic_rank', academicRank))))
  ) {
    return NextResponse.json(
      {
        message: 'คำนำหน้าชื่อ ประเภทบุคลากร ตำแหน่ง หรือวิทยฐานะไม่ถูกต้องหรือปิดใช้งานแล้ว',
      },
      { status: 400 }
    );
  }
  if (schoolId !== target.school_id) {
    const seat = await checkSchoolSeatLimit(
      schoolId,
      target.role as 'school_admin' | 'teacher' | 'student'
    );
    if (!seat.allowed) {
      return NextResponse.json({ message: seat.message }, { status: 409 });
    }
  }

  const updates: Record<string, unknown> = {
    username,
    first_name: firstName,
    last_name: lastName,
    email: email || null,
    school_id: schoolId,
  };
  if (target.role === 'teacher' || target.role === 'student') {
    updates.first_name_en = firstNameEn || null;
    updates.last_name_en = lastNameEn || null;
  }
  if (target.role === 'teacher') {
    updates.name_prefix = namePrefix;
    updates.staff_type = staffType;
    updates.employment_status = employmentStatus;
    updates.employment_start_date = employmentStartDate || null;
    updates.appointment_date = appointmentDate || null;
    updates.contract_end_date = contractEndDate || null;
    updates.position_title = positionTitle || null;
    updates.academic_rank = academicRank || null;
    updates.is_school_director = staffType === 'executive';
  }
  if (password) {
    updates.password_hash = await bcrypt.hash(password, 10);
    updates.must_change_password = true;
    updates.password_ciphertext =
      target.role === 'teacher' || target.role === 'student' ? encryptCredential(password) : null;
  }

  if (target.role !== 'student' && target.auth_user_id) {
    const authResult = await syncLinkedStaffAuth(
      {
        ...target,
        username,
        email: email || null,
        first_name: firstName,
        last_name: lastName,
        school_id: schoolId,
        auth_role: target.auth_role,
      },
      password ? { password } : undefined
    );
    if (!authResult.ok) {
      return NextResponse.json(
        { message: `ไม่สามารถอัปเดต Supabase Auth ได้: ${authResult.message}` },
        { status: 500 }
      );
    }
  }

  const { data: user, error } = await supabaseAdmin
    .from('app_users')
    .update(updates)
    .eq('id', id)
    .select(USER_SELECT)
    .single();

  if (error || !user) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถแก้ไขบัญชีได้' },
      { status: 500 }
    );
  }

  return NextResponse.json({ user });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['master_admin', 'school_admin', 'teacher']);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { id } = await params;
  const { data: target } = await getManagedUser(id);
  if (!target || !(await canManage(caller, target))) {
    return NextResponse.json({ message: 'ไม่พบบัญชีหรือไม่มีสิทธิ์จัดการ' }, { status: 404 });
  }

  const { count: gradedScoreCount } = await supabaseAdmin
    .from('scores')
    .select('id', { count: 'exact', head: true })
    .eq('graded_by', id);

  if (gradedScoreCount) {
    return NextResponse.json(
      {
        message: 'บัญชีนี้มีประวัติการบันทึกคะแนน จึงไม่สามารถลบได้ กรุณาปิดใช้งานแทน',
      },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin.from('app_users').delete().eq('id', id);
  if (error) {
    return NextResponse.json(
      { message: 'ไม่สามารถลบบัญชีได้ เนื่องจากมีข้อมูลที่เชื่อมโยงอยู่ กรุณาปิดใช้งานแทน' },
      { status: 409 }
    );
  }

  const { data: avatarFiles } = await supabaseAdmin.storage.from('profile-avatars').list(id);
  if (avatarFiles?.length) {
    await supabaseAdmin.storage
      .from('profile-avatars')
      .remove(avatarFiles.map((file) => `${id}/${file.name}`));
  }

  if (target.auth_user_id) {
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
      target.auth_user_id
    );
    if (authDeleteError) {
      console.error('Deleted app profile but failed to delete linked Supabase Auth user', {
        appUserId: id,
        authUserId: target.auth_user_id,
        message: authDeleteError.message,
      });
    }
  }

  return NextResponse.json({ success: true });
}
