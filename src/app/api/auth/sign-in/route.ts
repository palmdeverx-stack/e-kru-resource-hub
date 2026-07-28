import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { isSignInAllowed } from 'src/lib/auth-rate-limit';
import { verifyMarketplacePassword } from 'src/lib/marketplace-auth';
import { isSubscriptionUsable, loadSchoolSubscription } from 'src/lib/school-subscription';
import {
  signAppToken,
  toPublicUser,
  signPinChallenge,
  ACCESS_TOKEN_COOKIE,
  accessTokenCookieOptions,
} from 'src/lib/auth-token';
import {
  isStaffAuthRole,
  syncLinkedStaffAuth,
  linkStaffToSupabaseAuth,
  verifyStaffSupabasePassword,
} from 'src/lib/staff-supabase-auth';

// ----------------------------------------------------------------------

async function passwordHashMatches(password: string, hash: unknown): Promise<boolean> {
  if (typeof hash !== 'string' || !hash) return false;

  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

async function handleSignIn(request: Request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ message: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน' }, { status: 400 });
  }

  if (!(await isSignInAllowed(request, username))) {
    return NextResponse.json(
      { message: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่อีกครั้งในภายหลัง' },
      { status: 429 }
    );
  }

  const { data: user } = await supabaseAdmin
    .from('app_users')
    .select('*')
    .ilike('username', username)
    .single();

  if (!user) {
    const { data: marketplaceUser } = await supabaseAdmin
      .from('marketplace_users')
      .select('*')
      .ilike('username', username)
      .maybeSingle();

    if (
      !marketplaceUser ||
      marketplaceUser.is_active === false ||
      !(await verifyMarketplacePassword(marketplaceUser.email, password))
    ) {
      return NextResponse.json(
        { message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      );
    }

    const accessToken = signAppToken({
      sub: marketplaceUser.id,
      username: marketplaceUser.username,
      role: 'marketplace_user',
      schoolId: null,
    });
    const response = NextResponse.json({
      user: toPublicUser({ ...marketplaceUser, school_id: null }),
    });
    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions);
    return response;
  }

  let passwordMatches = false;
  if (user.role === 'student') {
    passwordMatches = await passwordHashMatches(password, user.password_hash);
  } else if (isStaffAuthRole(user.role)) {
    if (user.auth_user_id) {
      passwordMatches = await verifyStaffSupabasePassword(user, password);
      if (passwordMatches) {
        const synced = await syncLinkedStaffAuth(user, {
          isActive: user.is_active !== false,
        });
        if (!synced.ok) {
          console.error('Failed to sync Supabase Auth metadata', synced.message);
          return NextResponse.json(
            { message: 'ไม่สามารถอัปเดตข้อมูลบัญชีกลางได้ กรุณาลองใหม่อีกครั้ง' },
            { status: 503 }
          );
        }
      }
    } else {
      // One-time legacy verification. A successful login moves the credential
      // to Supabase Auth without asking the account holder to reset it.
      passwordMatches = await passwordHashMatches(password, user.password_hash);
      if (passwordMatches) {
        const linked = await linkStaffToSupabaseAuth(user, password);
        if (!linked.ok) {
          console.error('Failed to migrate staff account to Supabase Auth', linked.message);
          return NextResponse.json(
            {
              message:
                'ยืนยันรหัสผ่านสำเร็จ แต่ยังย้ายบัญชีไป Supabase Auth ไม่ได้ กรุณาติดต่อผู้ดูแลระบบ',
            },
            { status: 503 }
          );
        }
      }
    }
  }

  if (!passwordMatches) {
    return NextResponse.json({ message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
  }

  const studentCannotAccess =
    user.role === 'student' && (user.student_status ?? 'studying') !== 'studying';

  if (user.is_active === false || studentCannotAccess) {
    return NextResponse.json(
      {
        message: studentCannotAccess
          ? 'สถานะนักเรียนไม่สามารถเข้าใช้งานระบบได้ กรุณาติดต่อผู้ดูแลโรงเรียน'
          : 'บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลโรงเรียน',
      },
      { status: 403 }
    );
  }

  if (user.role !== 'master_admin') {
    const [{ data: school }, subscription] = await Promise.all([
      supabaseAdmin.from('schools').select('is_active').eq('id', user.school_id).maybeSingle(),
      loadSchoolSubscription(user.school_id),
    ]);
    if (!school?.is_active) {
      return NextResponse.json(
        { message: 'โรงเรียนถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ' },
        { status: 403 }
      );
    }
    if (!isSubscriptionUsable(subscription)) {
      return NextResponse.json(
        { message: 'แพ็กเกจโรงเรียนหมดอายุหรือถูกระงับ กรุณาติดต่อผู้ดูแลระบบ' },
        { status: 403 }
      );
    }
  }

  if (user.role === 'master_admin' || user.role === 'school_admin') {
    return NextResponse.json({
      requiresPin: true,
      pinChallengeToken: signPinChallenge(user.id),
      role: user.role,
    });
  }

  const accessToken = signAppToken({
    sub: user.id,
    username: user.username,
    role: user.role,
    schoolId: user.school_id,
  });

  const response = NextResponse.json({ user: toPublicUser(user) });
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions);
  return response;
}

export async function POST(request: Request) {
  try {
    return await handleSignIn(request);
  } catch (error) {
    console.error('Sign-in failed unexpectedly', error);
    return NextResponse.json(
      { message: 'ระบบเข้าสู่ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
