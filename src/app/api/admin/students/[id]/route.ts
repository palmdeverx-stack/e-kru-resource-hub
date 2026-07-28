import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { encryptCredential } from 'src/lib/credential-cipher';
import { canViewViaPermission, canManageViaPermission } from 'src/lib/department-permission-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

const STUDENT_SELECT =
  'id, username, email, first_name, last_name, avatar_url, role, school_id, created_at, must_change_password, student_status, student_code, national_id, name_prefix, first_name_en, last_name_en, nickname, gender, birth_date, nationality, ethnicity, religion, is_active';

async function loadStudent(id: string, schoolId: string) {
  return supabaseAdmin
    .from('app_users')
    .select(STUDENT_SELECT)
    .eq('id', id)
    .eq('school_id', schoolId)
    .eq('role', 'student')
    .maybeSingle();
}

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller?.schoolId || !(await canViewViaPermission(caller, 'students.manage'))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { data: student, error } = await loadStudent(id, caller.schoolId);
  if (error || !student) {
    return NextResponse.json({ message: 'ไม่พบนักเรียนนี้' }, { status: 404 });
  }

  return NextResponse.json({ student });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller?.schoolId || !(await canManageViaPermission(caller, 'students.manage'))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { data: currentStudent } = await loadStudent(id, caller.schoolId);
  if (!currentStudent) {
    return NextResponse.json({ message: 'ไม่พบนักเรียนนี้' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : '';
  const studentCode = typeof body?.studentCode === 'string' ? body.studentCode.trim() : '';
  const nationalId = typeof body?.nationalId === 'string' ? body.nationalId.trim() : '';
  const namePrefix = typeof body?.namePrefix === 'string' ? body.namePrefix.trim() : '';
  const firstNameEn = typeof body?.firstNameEn === 'string' ? body.firstNameEn.trim() : '';
  const lastNameEn = typeof body?.lastNameEn === 'string' ? body.lastNameEn.trim() : '';
  const nickname = typeof body?.nickname === 'string' ? body.nickname.trim() : '';
  const gender = typeof body?.gender === 'string' ? body.gender : '';
  const birthDate = typeof body?.birthDate === 'string' ? body.birthDate : '';
  const nationality = typeof body?.nationality === 'string' ? body.nationality.trim() : '';
  const ethnicity = typeof body?.ethnicity === 'string' ? body.ethnicity.trim() : '';
  const religion = typeof body?.religion === 'string' ? body.religion.trim() : '';

  if (!username || !firstName || !lastName || !studentCode) {
    return NextResponse.json(
      { message: 'กรุณากรอกรหัสนักเรียน ชื่อผู้ใช้งาน และชื่อ-นามสกุลให้ครบถ้วน' },
      { status: 400 }
    );
  }
  if (password && password.length < 6) {
    return NextResponse.json({ message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 400 });
  }
  if (nationalId && !/^\d{13}$/.test(nationalId)) {
    return NextResponse.json(
      { message: 'เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก' },
      { status: 400 }
    );
  }
  if (gender && !['male', 'female', 'other', 'unspecified'].includes(gender)) {
    return NextResponse.json({ message: 'ข้อมูลเพศไม่ถูกต้อง' }, { status: 400 });
  }
  if (birthDate && Number.isNaN(Date.parse(birthDate))) {
    return NextResponse.json({ message: 'วันเดือนปีเกิดไม่ถูกต้อง' }, { status: 400 });
  }
  if (birthDate && new Date(birthDate).getTime() > Date.now()) {
    return NextResponse.json(
      { message: 'วันเดือนปีเกิดต้องไม่เป็นวันที่ในอนาคต' },
      { status: 400 }
    );
  }

  const [{ data: duplicateUsername }, { data: duplicateStudentCode }, duplicateNationalIdResult] =
    await Promise.all([
      supabaseAdmin
        .from('app_users')
        .select('id')
        .ilike('username', username)
        .neq('id', id)
        .maybeSingle(),
      supabaseAdmin
        .from('app_users')
        .select('id')
        .eq('school_id', caller.schoolId)
        .ilike('student_code', studentCode)
        .neq('id', id)
        .maybeSingle(),
      nationalId
        ? supabaseAdmin
            .from('app_users')
            .select('id')
            .eq('national_id', nationalId)
            .neq('id', id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  if (duplicateUsername) {
    return NextResponse.json({ message: 'ชื่อผู้ใช้งานนี้ถูกใช้แล้ว' }, { status: 409 });
  }
  if (duplicateStudentCode) {
    return NextResponse.json({ message: 'รหัสนักเรียนนี้ถูกใช้แล้ว' }, { status: 409 });
  }
  if (duplicateNationalIdResult.data) {
    return NextResponse.json({ message: 'เลขประจำตัวประชาชนนี้ถูกใช้แล้ว' }, { status: 409 });
  }

  const updates: Record<string, unknown> = {
    username,
    email: email || null,
    first_name: firstName,
    last_name: lastName,
    student_code: studentCode,
    national_id: nationalId || null,
    name_prefix: namePrefix || null,
    first_name_en: firstNameEn || null,
    last_name_en: lastNameEn || null,
    nickname: nickname || null,
    gender: gender || null,
    birth_date: birthDate || null,
    nationality: nationality || null,
    ethnicity: ethnicity || null,
    religion: religion || null,
  };

  if (password) {
    updates.password_hash = await bcrypt.hash(password, 10);
    updates.password_ciphertext = encryptCredential(password);
    updates.must_change_password = true;
  }

  const { data: student, error } = await supabaseAdmin
    .from('app_users')
    .update(updates)
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .eq('role', 'student')
    .select(STUDENT_SELECT)
    .single();

  if (error || !student) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถแก้ไขข้อมูลนักเรียนได้' },
      { status: 500 }
    );
  }

  return NextResponse.json({ student });
}
