import bcrypt from 'bcryptjs';
import { after, NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { isSignInAllowed } from 'src/lib/auth-rate-limit';
import { writeSecurityAudit } from 'src/lib/security-audit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
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

    if (!marketplaceUser) {
      return NextResponse.json({ message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    if (marketplaceUser.is_suspended === true) {
      return NextResponse.json(
        { message: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' },
        { status: 403 }
      );
    }
    if (marketplaceUser.is_active === false) {
      return NextResponse.json(
        {
          message: 'บัญชียังไม่ได้ยืนยันอีเมล กรุณากรอกรหัสที่ส่งไปยังอีเมลของคุณ',
          requiresVerification: true,
          email: marketplaceUser.email,
        },
        { status: 403 }
      );
    }

    if (!(await verifyMarketplacePassword(marketplaceUser.email, password))) {
      return NextResponse.json({ message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    const accessToken = signAppToken({
      sub: marketplaceUser.id,
      username: marketplaceUser.username,
      role: 'marketplace_user',
      schoolId: null,
      sessionVersion: Number(marketplaceUser.session_version ?? 0),
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
              ...(process.env.NODE_ENV !== 'production' && {
                migrationError: linked.message,
              }),
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

  if (user.is_suspended === true || user.is_active === false || studentCannotAccess) {
    return NextResponse.json(
      {
        message:
          user.is_suspended === true
            ? 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ'
            : studentCannotAccess
              ? 'สถานะนักเรียนไม่สามารถเข้าใช้งานระบบได้ กรุณาติดต่อผู้ดูแลโรงเรียน'
              : 'บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลโรงเรียน',
      },
      { status: 403 }
    );
  }

  if (user.role !== 'master_admin' && user.role !== 'marketplace_admin') {
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
    sessionVersion: Number(user.session_version ?? 0),
  });

  const response = NextResponse.json({ user: toPublicUser(user) });
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions);
  return response;
}

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  let username = '';
  try {
    const body = (await request.clone().json()) as { username?: unknown };
    username = typeof body.username === 'string' ? body.username.trim().slice(0, 200) : '';
  } catch {
    // The route handler below returns the canonical invalid-request response.
  }

  try {
    const response = await handleSignIn(request);
    const responseBody = (await response
      .clone()
      .json()
      .catch(() => ({}))) as {
      user?: { id?: string; username?: string; role?: string };
      role?: string;
      requiresPin?: boolean;
    };

    after(() =>
      writeSecurityAudit({
        request,
        actorId: responseBody.user?.id ?? null,
        actorUsername: responseBody.user?.username ?? (username || null),
        actorRole: responseBody.user?.role ?? responseBody.role ?? null,
        category: 'authentication',
        action: 'auth.password_login',
        targetType: 'user_account',
        targetId: responseBody.user?.id ?? null,
        result: response.ok
          ? 'success'
          : [403, 429].includes(response.status)
            ? 'denied'
            : 'failure',
        metadata: {
          http_status: response.status,
          requires_pin: Boolean(responseBody.requiresPin),
        },
      })
    );

    return response;
  } catch (error) {
    console.error('Sign-in failed unexpectedly', error);
    after(() =>
      writeSecurityAudit({
        request,
        actorUsername: username || null,
        category: 'authentication',
        action: 'auth.password_login',
        result: 'failure',
        metadata: { http_status: 500, reason: 'unexpected_error' },
      })
    );
    return NextResponse.json(
      { message: 'ระบบเข้าสู่ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
