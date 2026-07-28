import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import {
  signAppToken,
  toPublicUser,
  ACCESS_TOKEN_COOKIE,
  accessTokenCookieOptions,
} from 'src/lib/auth-token';

// ----------------------------------------------------------------------

export async function POST(request: Request) {
  const body = await request.json();
  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  const email = String(body.email ?? '')
    .trim()
    .toLowerCase();
  const firstName = String(body.firstName ?? '').trim();
  const lastName = String(body.lastName ?? '').trim();

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
    supabaseAdmin
      .from('marketplace_users')
      .select('id')
      .ilike('username', username)
      .maybeSingle(),
  ]);

  if (appUser || marketplaceUser) {
    return NextResponse.json({ message: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' }, { status: 409 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
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
      first_name: firstName,
      last_name: lastName,
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

  const accessToken = signAppToken({
    sub: user.id,
    username: user.username,
    role: 'marketplace_user',
    schoolId: null,
  });

  const response = NextResponse.json({ user: toPublicUser({ ...user, school_id: null }) });
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions);
  return response;
}
