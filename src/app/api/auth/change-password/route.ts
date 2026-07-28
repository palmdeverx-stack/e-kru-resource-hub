import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { encryptCredential } from 'src/lib/credential-cipher';
import { toPublicUser, verifyAppToken, getRequestToken } from 'src/lib/auth-token';
import {
  isStaffAuthRole,
  syncLinkedStaffAuth,
  linkStaffToSupabaseAuth,
} from 'src/lib/staff-supabase-auth';

// ----------------------------------------------------------------------

export async function POST(request: Request) {
  const token = getRequestToken(request);
  const payload = token ? verifyAppToken(token) : null;

  if (!payload) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const { newPassword } = await request.json();

  if (!newPassword || String(newPassword).length < 6) {
    return NextResponse.json(
      { message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' },
      { status: 400 }
    );
  }

  const { data: currentUser } = await supabaseAdmin
    .from('app_users')
    .select('*')
    .eq('id', payload.sub)
    .maybeSingle();

  if (!currentUser) {
    return NextResponse.json({ message: 'ไม่พบบัญชีผู้ใช้งาน' }, { status: 404 });
  }

  if (isStaffAuthRole(currentUser.role)) {
    const authResult = currentUser.auth_user_id
      ? await syncLinkedStaffAuth(currentUser, { password: newPassword })
      : await linkStaffToSupabaseAuth(currentUser, newPassword);
    if (!authResult.ok) {
      return NextResponse.json(
        { message: `ไม่สามารถเปลี่ยนรหัสผ่าน Supabase Auth ได้: ${authResult.message}` },
        { status: 500 }
      );
    }
  }

  const { data: user, error } = await supabaseAdmin
    .from('app_users')
    .update({
      password_hash: await bcrypt.hash(newPassword, 10),
      password_ciphertext:
        payload.role === 'student' ? encryptCredential(newPassword) : null,
      must_change_password: false,
    })
    .eq('id', payload.sub)
    .select('*')
    .single();

  if (error || !user) {
    return NextResponse.json(
      { message: error?.message ?? 'Failed to change password' },
      { status: 500 }
    );
  }

  return NextResponse.json({ user: toPublicUser(user) });
}
