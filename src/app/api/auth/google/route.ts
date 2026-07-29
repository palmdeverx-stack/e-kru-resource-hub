import type { User } from '@supabase/supabase-js';

import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { isSubscriptionUsable, loadSchoolSubscription } from 'src/lib/school-subscription';
import {
  signAppToken,
  toPublicUser,
  signPinChallenge,
  ACCESS_TOKEN_COOKIE,
  accessTokenCookieOptions,
} from 'src/lib/auth-token';

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

function googleProfile(authUser: User) {
  const metadata = authUser.user_metadata ?? {};
  const fullName = String(metadata.full_name ?? metadata.name ?? '').trim();
  const [fallbackFirstName = 'Google', ...fallbackLastName] = fullName.split(/\s+/);

  return {
    firstName: String(metadata.given_name ?? fallbackFirstName).trim() || 'Google',
    lastName: String(metadata.family_name ?? fallbackLastName.join(' ')).trim() || 'User',
  };
}

async function uniqueUsername(email: string, authUserId: string) {
  const emailPrefix =
    email
      .split('@')[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .slice(0, 28) || 'google';
  const suffix = authUserId.replace(/-/g, '').slice(0, 6);
  const candidates = [emailPrefix, `${emailPrefix}_${suffix}`];

  for (const candidate of candidates) {
    const [{ data: appUser }, { data: marketplaceUser }] = await Promise.all([
      supabaseAdmin.from('app_users').select('id').ilike('username', candidate).maybeSingle(),
      supabaseAdmin
        .from('marketplace_users')
        .select('id')
        .ilike('username', candidate)
        .maybeSingle(),
    ]);
    if (!appUser && !marketplaceUser) return candidate;
  }

  return `google_${authUserId.replace(/-/g, '').slice(0, 12)}`;
}

async function validateSchoolUser(user: Record<string, any>) {
  const studentCannotAccess =
    user.role === 'student' && (user.student_status ?? 'studying') !== 'studying';
  if (user.is_active === false || studentCannotAccess) {
    return studentCannotAccess
      ? 'สถานะนักเรียนไม่สามารถเข้าใช้งานระบบได้ กรุณาติดต่อผู้ดูแลโรงเรียน'
      : 'บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
  }
  if (user.role === 'master_admin') return null;
  if (!user.school_id) return 'บัญชีนี้ยังไม่ได้เชื่อมกับโรงเรียน';

  const [{ data: school }, subscription] = await Promise.all([
    supabaseAdmin.from('schools').select('is_active').eq('id', user.school_id).maybeSingle(),
    loadSchoolSubscription(user.school_id),
  ]);
  if (!school?.is_active) return 'โรงเรียนถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
  if (!isSubscriptionUsable(subscription)) {
    return 'แพ็กเกจโรงเรียนหมดอายุหรือถูกระงับ กรุณาติดต่อผู้ดูแลระบบ';
  }
  return null;
}

function authenticatedResponse(user: Parameters<typeof toPublicUser>[0]) {
  const accessToken = signAppToken({
    sub: user.id,
    username: user.username,
    role: user.role,
    schoolId: user.school_id ?? null,
  });
  const response = NextResponse.json({ user: toPublicUser(user) });
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions);
  return response;
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ message: 'ไม่พบ Google session' }, { status: 401 });
  }

  const {
    data: { user: authUser },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authUser?.email || !authUser.email_confirmed_at) {
    return NextResponse.json(
      { message: 'ไม่สามารถยืนยันบัญชี Google ได้ กรุณาลองใหม่อีกครั้ง' },
      { status: 401 }
    );
  }

  const providers = authUser.app_metadata?.providers as string[] | undefined;
  if (authUser.app_metadata?.provider !== 'google' && !providers?.includes('google')) {
    return NextResponse.json({ message: 'Session นี้ไม่ได้มาจาก Google' }, { status: 400 });
  }

  const [{ data: appUserByAuth }, { data: marketplaceUserByAuth }] = await Promise.all([
    supabaseAdmin.from('app_users').select('*').eq('auth_user_id', authUser.id).maybeSingle(),
    supabaseAdmin
      .from('marketplace_users')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .maybeSingle(),
  ]);

  if (appUserByAuth) {
    const accessError = await validateSchoolUser(appUserByAuth);
    if (accessError) return NextResponse.json({ message: accessError }, { status: 403 });

    await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      app_metadata: { ...authUser.app_metadata, role: appUserByAuth.role },
    });

    if (['master_admin', 'school_admin'].includes(appUserByAuth.role)) {
      return NextResponse.json({
        requiresPin: true,
        pinChallengeToken: signPinChallenge(appUserByAuth.id),
        role: appUserByAuth.role,
      });
    }
    return authenticatedResponse(appUserByAuth);
  }

  if (marketplaceUserByAuth) {
    const marketplaceUser =
      marketplaceUserByAuth.is_active === false
        ? (
            await supabaseAdmin
              .from('marketplace_users')
              .update({ is_active: true, updated_at: new Date().toISOString() })
              .eq('id', marketplaceUserByAuth.id)
              .select('*')
              .single()
          ).data
        : marketplaceUserByAuth;
    if (!marketplaceUser) {
      return NextResponse.json({ message: 'เปิดใช้งานบัญชีไม่สำเร็จ' }, { status: 500 });
    }
    return authenticatedResponse({ ...marketplaceUser, school_id: null });
  }

  const email = authUser.email.toLowerCase();
  const [{ data: appUserByEmail }, { data: marketplaceUserByEmail }] = await Promise.all([
    supabaseAdmin.from('app_users').select('id, auth_user_id').ilike('email', email).maybeSingle(),
    supabaseAdmin
      .from('marketplace_users')
      .select('id, auth_user_id')
      .ilike('email', email)
      .maybeSingle(),
  ]);
  if (appUserByEmail || marketplaceUserByEmail) {
    return NextResponse.json(
      {
        message:
          'อีเมลนี้มีบัญชี E-KRU อยู่แล้ว แต่ยังไม่ได้เชื่อมกับ Google กรุณาเข้าสู่ระบบด้วยชื่อผู้ใช้ก่อน',
      },
      { status: 409 }
    );
  }

  const profile = googleProfile(authUser);
  const username = await uniqueUsername(email, authUser.id);
  const { data: newUser, error: insertError } = await supabaseAdmin
    .from('marketplace_users')
    .insert({
      auth_user_id: authUser.id,
      username,
      email,
      display_name: `${profile.firstName} ${profile.lastName}`.trim(),
      first_name: profile.firstName,
      last_name: profile.lastName,
      is_active: true,
    })
    .select('*')
    .single();
  if (insertError || !newUser) {
    return NextResponse.json(
      {
        message:
          insertError?.code === '42P01'
            ? 'ยังไม่ได้ติดตั้ง Marketplace schema ใน Supabase'
            : (insertError?.message ?? 'สร้างบัญชี Marketplace ไม่สำเร็จ'),
      },
      { status: 500 }
    );
  }

  await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
    app_metadata: { ...authUser.app_metadata, role: 'marketplace_user' },
    user_metadata: {
      ...authUser.user_metadata,
      username,
      first_name: profile.firstName,
      last_name: profile.lastName,
    },
  });

  return authenticatedResponse({ ...newUser, school_id: null });
}
