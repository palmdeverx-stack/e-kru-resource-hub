import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import {
  verificationExpiry,
  hashVerificationCode,
  createVerificationCode,
  sendMarketplaceVerificationEmail,
} from 'src/sections/marketplace/auth/server/email-verification';

// ----------------------------------------------------------------------

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const body = await request.json();
  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  const email = String(body.email ?? '')
    .trim()
    .toLowerCase();
  const firstName = String(body.firstName ?? '').trim();
  const lastName = String(body.lastName ?? '').trim();

  if (
    !(await isActionAllowed({
      request,
      action: 'auth-sign-up',
      subject: email,
      maxAttempts: 5,
      windowSeconds: 60 * 60,
    }))
  ) {
    return NextResponse.json(
      { message: 'สร้างบัญชีบ่อยเกินไป กรุณาลองใหม่ภายหลัง' },
      { status: 429 }
    );
  }

  if (!username || !email || !firstName || !lastName || password.length < 8) {
    return NextResponse.json(
      { message: 'กรุณากรอกข้อมูลให้ครบ และใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร' },
      { status: 400 }
    );
  }

  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
    return NextResponse.json(
      { message: 'ชื่อผู้ใช้ต้องมี 3–40 ตัวอักษร และใช้เฉพาะ a-z, 0-9, จุด ขีดกลาง หรือขีดล่าง' },
      { status: 400 }
    );
  }

  const [{ data: appUser }, { data: marketplaceUser }] = await Promise.all([
    supabaseAdmin.from('app_users').select('id').ilike('username', username).maybeSingle(),
    supabaseAdmin.from('marketplace_users').select('id').ilike('username', username).maybeSingle(),
  ]);

  if (appUser || marketplaceUser) {
    return NextResponse.json({ message: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' }, { status: 409 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    app_metadata: { role: 'marketplace_user' },
    user_metadata: { username, first_name: firstName, last_name: lastName },
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { message: authError?.message ?? 'ไม่สามารถสร้างบัญชีได้' },
      { status: 400 }
    );
  }

  const { data: user, error: insertError } = await supabaseAdmin
    .from('marketplace_users')
    .insert({
      auth_user_id: authData.user.id,
      username,
      email,
      display_name: `${firstName} ${lastName}`.trim(),
      first_name: firstName,
      last_name: lastName,
      is_active: false,
    })
    .select('*')
    .single();

  if (insertError || !user) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json(
      {
        message:
          insertError?.code === '42P01'
            ? 'ยังไม่ได้ติดตั้ง Marketplace schema ใน Supabase'
            : (insertError?.message ?? 'ไม่สามารถบันทึกบัญชีได้'),
      },
      { status: 500 }
    );
  }

  const code = createVerificationCode();
  const { error: verificationError } = await supabaseAdmin
    .from('marketplace_email_verifications')
    .insert({
      user_id: user.id,
      email,
      code_hash: hashVerificationCode(user.id, code),
      expires_at: verificationExpiry(),
      last_sent_at: new Date().toISOString(),
    });

  if (verificationError) {
    await supabaseAdmin.from('marketplace_users').delete().eq('id', user.id);
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json(
      {
        message:
          verificationError.code === '42P01'
            ? 'กรุณารัน Marketplace schema เวอร์ชันล่าสุดใน Supabase'
            : verificationError.message,
      },
      { status: 500 }
    );
  }

  try {
    await sendMarketplaceVerificationEmail({ to: email, firstName, code });
  } catch (emailError) {
    await supabaseAdmin.from('marketplace_users').delete().eq('id', user.id);
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    console.error('Failed to send marketplace verification email', emailError);
    return NextResponse.json(
      { message: 'ไม่สามารถส่งอีเมลยืนยันได้ กรุณาตรวจสอบอีเมลและลองใหม่อีกครั้ง' },
      { status: 503 }
    );
  }

  return NextResponse.json({
    requiresVerification: true,
    email,
    expiresInMinutes: 10,
  });
}
