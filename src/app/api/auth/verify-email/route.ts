import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import {
  signAppToken,
  toPublicUser,
  ACCESS_TOKEN_COOKIE,
  accessTokenCookieOptions,
} from 'src/lib/auth-token';

import {
  OTP_MAX_ATTEMPTS,
  verificationCodesMatch,
} from 'src/sections/marketplace/auth/server/email-verification';

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email ?? '')
    .trim()
    .toLowerCase();
  const code = String(body.code ?? '').trim();

  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ message: 'กรุณากรอกรหัสยืนยัน 6 หลัก' }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from('marketplace_users')
    .select('*')
    .ilike('email', email)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ message: 'ไม่พบคำขอยืนยันอีเมล' }, { status: 404 });
  }
  if (user.is_suspended === true) {
    return NextResponse.json(
      { message: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' },
      { status: 403 }
    );
  }

  const { data: verification, error } = await supabaseAdmin
    .from('marketplace_email_verifications')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !verification) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบรหัสยืนยัน กรุณาขอรหัสใหม่' },
      { status: 404 }
    );
  }

  if (verification.verified_at || user.is_active) {
    return NextResponse.json({ message: 'อีเมลนี้ได้รับการยืนยันแล้ว' }, { status: 409 });
  }

  if (verification.attempts >= OTP_MAX_ATTEMPTS) {
    return NextResponse.json(
      { message: 'กรอกรหัสผิดเกินจำนวนที่กำหนด กรุณาขอรหัสใหม่' },
      { status: 429 }
    );
  }

  if (new Date(verification.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ message: 'รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่' }, { status: 410 });
  }

  if (!verificationCodesMatch(verification.code_hash, user.id, code)) {
    await supabaseAdmin
      .from('marketplace_email_verifications')
      .update({
        attempts: verification.attempts + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);
    return NextResponse.json({ message: 'รหัสยืนยันไม่ถูกต้อง' }, { status: 400 });
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user.auth_user_id, {
    email_confirm: true,
  });
  if (authError) {
    return NextResponse.json({ message: authError.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const [{ data: activeUser, error: userError }, { error: verificationError }] = await Promise.all([
    supabaseAdmin
      .from('marketplace_users')
      .update({ is_active: true, updated_at: now })
      .eq('id', user.id)
      .select('*')
      .single(),
    supabaseAdmin
      .from('marketplace_email_verifications')
      .update({ verified_at: now, updated_at: now })
      .eq('user_id', user.id),
  ]);

  if (userError || verificationError || !activeUser) {
    return NextResponse.json(
      { message: userError?.message ?? verificationError?.message ?? 'ไม่สามารถยืนยันบัญชีได้' },
      { status: 500 }
    );
  }

  const accessToken = signAppToken({
    sub: activeUser.id,
    username: activeUser.username,
    role: 'marketplace_user',
    schoolId: null,
  });
  const response = NextResponse.json({
    user: toPublicUser({ ...activeUser, school_id: null }),
  });
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions);
  return response;
}
