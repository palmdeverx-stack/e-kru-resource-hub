import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { writeSecurityAudit } from 'src/lib/security-audit';
import { encryptCredential } from 'src/lib/credential-cipher';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import {
  isStaffAuthRole,
  syncLinkedStaffAuth,
  linkStaffToSupabaseAuth,
} from 'src/lib/staff-supabase-auth';
import {
  signAppToken,
  toPublicUser,
  verifyAppToken,
  getRequestToken,
  ACCESS_TOKEN_COOKIE,
  accessTokenCookieOptions,
} from 'src/lib/auth-token';

// ----------------------------------------------------------------------

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const token = getRequestToken(request);
  const payload = token ? verifyAppToken(token) : null;

  if (!payload) {
    await writeSecurityAudit({
      request,
      category: 'account',
      action: 'account.password_change',
      result: 'denied',
    });
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const { newPassword } = await request.json();

  if (!newPassword || String(newPassword).length < 8) {
    return NextResponse.json(
      { message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' },
      { status: 400 }
    );
  }

  if (payload.role === 'marketplace_user') {
    const { data: marketplaceUser } = await supabaseAdmin
      .from('marketplace_users')
      .select('*')
      .eq('id', payload.sub)
      .maybeSingle();
    if (!marketplaceUser?.auth_user_id) {
      return NextResponse.json({ message: 'ไม่พบบัญชีผู้ใช้งาน' }, { status: 404 });
    }
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      marketplaceUser.auth_user_id,
      { password: String(newPassword) }
    );
    if (authError) return NextResponse.json({ message: authError.message }, { status: 500 });
    const nextSessionVersion = Number(marketplaceUser.session_version ?? 0) + 1;
    const { data: user, error } = await supabaseAdmin
      .from('marketplace_users')
      .update({ session_version: nextSessionVersion, updated_at: new Date().toISOString() })
      .eq('id', payload.sub)
      .select('*')
      .single();
    if (error || !user) {
      return NextResponse.json(
        { message: error?.message ?? 'เปลี่ยนรหัสผ่านไม่สำเร็จ' },
        { status: 500 }
      );
    }
    const response = NextResponse.json({ user: toPublicUser({ ...user, school_id: null }) });
    response.cookies.set(
      ACCESS_TOKEN_COOKIE,
      signAppToken({
        sub: user.id,
        username: user.username,
        role: 'marketplace_user',
        schoolId: null,
        sessionVersion: nextSessionVersion,
      }),
      accessTokenCookieOptions
    );
    return response;
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
      password_ciphertext: payload.role === 'student' ? encryptCredential(newPassword) : null,
      must_change_password: false,
      session_version: Number(currentUser.session_version ?? 0) + 1,
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

  await writeSecurityAudit({
    request,
    actorId: payload.sub,
    actorUsername: payload.username,
    actorRole: payload.role,
    category: 'account',
    action: 'account.password_change',
    targetType: 'user_account',
    targetId: payload.sub,
    result: 'success',
  });

  const response = NextResponse.json({ user: toPublicUser(user) });
  response.cookies.set(
    ACCESS_TOKEN_COOKIE,
    signAppToken({
      sub: user.id,
      username: user.username,
      role: user.role,
      schoolId: user.school_id,
      sessionVersion: Number(user.session_version ?? 0),
    }),
    accessTokenCookieOptions
  );
  return response;
}
