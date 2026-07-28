import 'server-only';

import type { AppTokenPayload } from 'src/lib/auth-token';
import type { StaffType, EmploymentStatus } from 'src/types/staff-employment';

import bcrypt from 'bcryptjs';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { generatePassword } from 'src/lib/generate-password';
import { encryptCredential } from 'src/lib/credential-cipher';
import { isActiveStaffMasterValue } from 'src/lib/staff-master';
import { linkStaffToSupabaseAuth } from 'src/lib/staff-supabase-auth';
import { schoolHasFeature, checkSchoolSeatLimit } from 'src/lib/school-subscription';
import { getEffectiveDepartmentPermissions } from 'src/lib/department-permission-access';

import { isStaffType, isEmploymentStatus } from 'src/types/staff-employment';

// ----------------------------------------------------------------------

const SCHOOL_ADMIN_CREATABLE_ROLES = ['teacher', 'student'] as const;

export type CreateManagedUserInput = {
  username: string;
  email?: string;
  password?: string;
  firstName: string;
  lastName: string;
  role: 'school_admin' | 'teacher' | 'student';
  schoolId?: string;
  studentCode?: string;
  nationalId?: string;
  namePrefix?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  nickname?: string;
  gender?: string;
  birthDate?: string;
  nationality?: string;
  ethnicity?: string;
  religion?: string;
  /** Student import flows start unconfirmed until an administrator reviews the record. */
  pendingConfirmation?: boolean;
  staffType?: StaffType;
  employmentStatus?: EmploymentStatus;
  employmentStartDate?: string;
  appointmentDate?: string;
  contractEndDate?: string;
  positionTitle?: string;
  academicRank?: string;
};

export type CreateManagedUserResult =
  | { ok: true; user: Record<string, unknown>; generatedPassword?: string }
  | { ok: false; status: number; message: string };

/**
 * Shared by the single-create route and the bulk Excel import — keeps every
 * caller-role rule, feature gate, seat limit, and duplicate check in one
 * place instead of drifting between two implementations.
 */
export async function createManagedUser(
  caller: AppTokenPayload,
  input: CreateManagedUserInput
): Promise<CreateManagedUserResult> {
  const {
    username,
    email,
    password: providedPassword,
    firstName,
    lastName,
    role,
    schoolId,
    studentCode,
    nationalId,
    namePrefix,
    firstNameEn,
    lastNameEn,
    nickname,
    gender,
    birthDate,
    nationality,
    ethnicity,
    religion,
    pendingConfirmation,
    staffType,
    employmentStatus,
    employmentStartDate,
    appointmentDate,
    contractEndDate,
    positionTitle,
    academicRank,
  } = input;

  if (!username || !firstName || !lastName || !role) {
    return { ok: false, status: 400, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' };
  }

  if (role === 'student' && !studentCode?.trim()) {
    return { ok: false, status: 400, message: 'กรุณากรอกรหัสนักเรียน' };
  }
  if (role === 'student' && nationalId?.trim() && !/^\d{13}$/.test(nationalId.trim())) {
    return { ok: false, status: 400, message: 'เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก' };
  }
  if (
    role === 'student' &&
    gender &&
    !['male', 'female', 'other', 'unspecified'].includes(gender)
  ) {
    return { ok: false, status: 400, message: 'ข้อมูลเพศไม่ถูกต้อง' };
  }
  if (role === 'student' && birthDate && Number.isNaN(Date.parse(birthDate))) {
    return { ok: false, status: 400, message: 'วันเดือนปีเกิดไม่ถูกต้อง' };
  }
  if (role === 'student' && birthDate && new Date(birthDate).getTime() > Date.now()) {
    return { ok: false, status: 400, message: 'วันเดือนปีเกิดต้องไม่เป็นวันที่ในอนาคต' };
  }
  if (role === 'teacher' && !isStaffType(staffType)) {
    return { ok: false, status: 400, message: 'กรุณาเลือกประเภทบุคลากร' };
  }
  if (role === 'teacher' && !isEmploymentStatus(employmentStatus)) {
    return { ok: false, status: 400, message: 'กรุณาเลือกสถานะการทำงาน' };
  }
  const employmentDates = [employmentStartDate, appointmentDate, contractEndDate].filter(Boolean);
  if (
    role === 'teacher' &&
    employmentDates.some((date) => Number.isNaN(Date.parse(date as string)))
  ) {
    return { ok: false, status: 400, message: 'วันที่ในข้อมูลการทำงานไม่ถูกต้อง' };
  }
  if (
    role === 'teacher' &&
    employmentStartDate &&
    contractEndDate &&
    contractEndDate < employmentStartDate
  ) {
    return { ok: false, status: 400, message: 'วันที่สิ้นสุดสัญญาต้องไม่ก่อนวันที่เริ่มงาน' };
  }

  // Teacher/student passwords are auto-generated: the account holder must
  // change it on first login anyway, so there's no need for the admin to type one.
  const isAutoGenRole = role === 'teacher' || role === 'student';

  if (!isAutoGenRole && !providedPassword) {
    return { ok: false, status: 400, message: 'กรุณากรอกรหัสผ่าน' };
  }

  const permissions =
    caller.role === 'teacher' && caller.schoolId
      ? await getEffectiveDepartmentPermissions(caller.sub, caller.schoolId)
      : [];
  const hasStaffManage = permissions.includes('staff.manage');
  const hasStudentsManage = permissions.includes('students.manage');
  const isDelegatedAdmin = caller.role === 'teacher' && (hasStaffManage || hasStudentsManage);

  let targetSchoolId: string;

  if (caller.role === 'master_admin') {
    if (role !== 'school_admin' || !schoolId) {
      return {
        ok: false,
        status: 400,
        message: 'ผู้ดูแลระบบสร้างได้เฉพาะบัญชีผู้ดูแลโรงเรียน และต้องระบุโรงเรียนด้วย',
      };
    }
    targetSchoolId = schoolId;
  } else if (caller.role === 'school_admin' || (caller.role === 'teacher' && hasStaffManage)) {
    if (!(SCHOOL_ADMIN_CREATABLE_ROLES as readonly string[]).includes(role)) {
      return { ok: false, status: 400, message: 'สร้างได้เฉพาะบัญชีครูหรือนักเรียน' };
    }
    targetSchoolId = caller.schoolId!;
  } else if (caller.role === 'teacher' && hasStudentsManage) {
    if (role !== 'student') {
      return { ok: false, status: 403, message: 'สร้างได้เฉพาะบัญชีนักเรียน' };
    }
    targetSchoolId = caller.schoolId!;
  } else {
    return {
      ok: false,
      status: 403,
      message: 'การสร้างบัญชีสงวนไว้เฉพาะผู้ดูแลโรงเรียน',
    };
  }

  if (
    role === 'teacher' &&
    (!staffType || !(await isActiveStaffMasterValue(targetSchoolId, 'staff_type', staffType)))
  ) {
    return { ok: false, status: 400, message: 'ประเภทบุคลากรไม่ถูกต้องหรือปิดใช้งานแล้ว' };
  }
  if (
    role === 'teacher' &&
    (!namePrefix?.trim() ||
      !(await isActiveStaffMasterValue(targetSchoolId, 'prefix', namePrefix.trim())))
  ) {
    return { ok: false, status: 400, message: 'คำนำหน้าชื่อไม่ถูกต้องหรือปิดใช้งานแล้ว' };
  }
  if (
    role === 'teacher' &&
    positionTitle?.trim() &&
    !(await isActiveStaffMasterValue(targetSchoolId, 'position', positionTitle.trim()))
  ) {
    return { ok: false, status: 400, message: 'ตำแหน่งไม่ถูกต้องหรือปิดใช้งานแล้ว' };
  }
  if (
    role === 'teacher' &&
    academicRank?.trim() &&
    !(await isActiveStaffMasterValue(targetSchoolId, 'academic_rank', academicRank.trim()))
  ) {
    return { ok: false, status: 400, message: 'วิทยฐานะไม่ถูกต้องหรือปิดใช้งานแล้ว' };
  }

  const requiredFeature = isDelegatedAdmin
    ? null
    : caller.role === 'teacher'
      ? 'teacher.manage_enrollments'
      : role === 'teacher'
        ? 'admin.staff'
        : role === 'student'
          ? 'admin.students'
          : null;
  if (
    (caller.role === 'school_admin' || caller.role === 'teacher') &&
    requiredFeature &&
    !(await schoolHasFeature(targetSchoolId, requiredFeature))
  ) {
    return { ok: false, status: 403, message: 'แพ็กเกจโรงเรียนไม่รองรับการสร้างบัญชีประเภทนี้' };
  }

  const seat = await checkSchoolSeatLimit(
    targetSchoolId,
    role as 'school_admin' | 'teacher' | 'student'
  );
  if (!seat.allowed) {
    return { ok: false, status: 409, message: seat.message ?? 'ไม่สามารถสร้างบัญชีได้' };
  }

  const { data: existing } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .ilike('username', username)
    .maybeSingle();

  if (existing) {
    return { ok: false, status: 409, message: 'ชื่อผู้ใช้งานนี้ถูกใช้แล้ว' };
  }

  if (role === 'student') {
    const [{ data: duplicateStudentCode }, { data: duplicateNationalId }] = await Promise.all([
      supabaseAdmin
        .from('app_users')
        .select('id')
        .eq('school_id', targetSchoolId)
        .ilike('student_code', studentCode!.trim())
        .maybeSingle(),
      nationalId?.trim()
        ? supabaseAdmin
            .from('app_users')
            .select('id')
            .eq('national_id', nationalId.trim())
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (duplicateStudentCode) {
      return { ok: false, status: 409, message: 'รหัสนักเรียนนี้ถูกใช้แล้ว' };
    }
    if (duplicateNationalId) {
      return { ok: false, status: 409, message: 'เลขประจำตัวประชาชนนี้ถูกใช้แล้ว' };
    }
  }

  const password = providedPassword || generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const supportsBilingualName = role === 'teacher' || role === 'student';

  const { data: user, error } = await supabaseAdmin
    .from('app_users')
    .insert({
      username,
      password_hash: passwordHash,
      password_ciphertext: isAutoGenRole ? encryptCredential(password) : null,
      must_change_password: true,
      email: email || null,
      first_name: firstName,
      last_name: lastName,
      role,
      school_id: targetSchoolId,
      student_status: role === 'student' ? 'studying' : null,
      student_code: role === 'student' ? studentCode!.trim() : null,
      national_id: role === 'student' ? nationalId?.trim() || null : null,
      name_prefix: role === 'student' || role === 'teacher' ? namePrefix?.trim() || null : null,
      first_name_en: supportsBilingualName ? firstNameEn?.trim() || null : null,
      last_name_en: supportsBilingualName ? lastNameEn?.trim() || null : null,
      nickname: role === 'student' ? nickname?.trim() || null : null,
      gender: role === 'student' ? gender || null : null,
      birth_date: role === 'student' ? birthDate || null : null,
      nationality: role === 'student' ? nationality?.trim() || null : null,
      ethnicity: role === 'student' ? ethnicity?.trim() || null : null,
      religion: role === 'student' ? religion?.trim() || null : null,
      staff_type: role === 'teacher' ? staffType : null,
      employment_status: role === 'teacher' ? employmentStatus : null,
      employment_start_date: role === 'teacher' ? employmentStartDate || null : null,
      appointment_date: role === 'teacher' ? appointmentDate || null : null,
      contract_end_date: role === 'teacher' ? contractEndDate || null : null,
      position_title: role === 'teacher' ? positionTitle?.trim() || null : null,
      academic_rank: role === 'teacher' ? academicRank?.trim() || null : null,
      is_school_director: role === 'teacher' && staffType === 'executive',
      is_active: true,
      ...(role === 'student' && pendingConfirmation && { import_confirmed_at: null }),
    })
    .select(
      'id, username, email, first_name, last_name, avatar_url, role, school_id, created_at, must_change_password, student_status, student_code, national_id, name_prefix, first_name_en, last_name_en, nickname, gender, birth_date, nationality, ethnicity, religion, is_active, import_confirmed_at, staff_type, employment_status, employment_start_date, appointment_date, contract_end_date, position_title, academic_rank, is_school_director'
    )
    .single();

  if (error || !user) {
    return { ok: false, status: 500, message: error?.message ?? 'Failed to create user' };
  }

  if (role !== 'student') {
    const linked = await linkStaffToSupabaseAuth(
      {
        ...user,
        role,
        school_id: targetSchoolId,
        first_name: firstName,
        last_name: lastName,
      },
      password
    );
    if (!linked.ok) {
      await supabaseAdmin.from('app_users').delete().eq('id', user.id);
      return {
        ok: false,
        status: 500,
        message: `ไม่สามารถสร้างบัญชี Supabase Auth ได้: ${linked.message}`,
      };
    }
  }

  return { ok: true, user, generatedPassword: isAutoGenRole ? password : undefined };
}
