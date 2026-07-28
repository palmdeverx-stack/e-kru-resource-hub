import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import {
  verifyGuardianPortalToken,
  signGuardianPortalSessionToken,
} from 'src/lib/guardian-portal-token';

// ----------------------------------------------------------------------

async function findStudent(schoolId: string, studentCode: string) {
  const { data: byStudentCode } = await supabaseAdmin
    .from('app_users')
    .select('id, student_code, is_active, student_status')
    .eq('school_id', schoolId)
    .eq('role', 'student')
    .ilike('student_code', studentCode)
    .limit(5);
  const normalized = studentCode.toLocaleLowerCase('en');
  const exactStudentCode = (byStudentCode ?? []).find(
    (student) => student.student_code?.toLocaleLowerCase('en') === normalized
  );
  return exactStudentCode ?? null;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const identityToken = cookieStore.get('guardian_portal_identity')?.value ?? '';
  const identity =
    verifyGuardianPortalToken(identityToken, 'identity') ??
    verifyGuardianPortalToken(identityToken, 'link');
  if (!identity) {
    return NextResponse.json(
      { message: 'กรุณาเปิด Parent Portal จากลิงก์ใน LINE ผู้ปกครอง' },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const studentCode = typeof body?.studentCode === 'string' ? body.studentCode.trim() : '';
  if (!studentCode || studentCode.length > 50 || /[%]/.test(studentCode)) {
    return NextResponse.json({ message: 'กรุณากรอกรหัสนักเรียนให้ถูกต้อง' }, { status: 400 });
  }

  const student = await findStudent(identity.schoolId, studentCode);
  if (
    !student ||
    student.is_active === false ||
    (student.student_status ?? 'studying') !== 'studying'
  ) {
    return NextResponse.json({ message: 'ไม่พบนักเรียนที่ใช้งานอยู่ด้วยรหัสนี้' }, { status: 404 });
  }

  const { count: guardianCount } = await supabaseAdmin
    .from('student_guardians')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', identity.schoolId)
    .eq('student_id', student.id)
    .eq('line_user_id', identity.lineUserId);
  if (!guardianCount) {
    return NextResponse.json(
      { message: 'รหัสนักเรียนไม่ตรงกับบัญชี LINE ผู้ปกครองที่เชื่อมไว้' },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: 'guardian_portal_session',
    value: signGuardianPortalSessionToken(identity.schoolId, identity.lineUserId, student.id),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('guardian_portal_session');
  return response;
}
