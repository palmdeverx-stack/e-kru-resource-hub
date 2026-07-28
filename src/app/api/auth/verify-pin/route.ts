import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { isSignInAllowed } from 'src/lib/auth-rate-limit';
import { isSubscriptionUsable, loadSchoolSubscription } from 'src/lib/school-subscription';
import {
  signAppToken,
  toPublicUser,
  verifyPinChallenge,
  ACCESS_TOKEN_COOKIE,
  accessTokenCookieOptions,
} from 'src/lib/auth-token';

// ----------------------------------------------------------------------

function pinsMatch(pin: string, expectedPin: string): boolean {
  const actual = Buffer.from(pin);
  const expected = Buffer.from(expectedPin);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  const { pinChallengeToken, pin } = await request.json();

  if (typeof pinChallengeToken !== 'string' || !/^\d{8}$/.test(String(pin ?? ''))) {
    return NextResponse.json({ message: 'กรุณากรอก PIN เป็นตัวเลข 8 หลัก' }, { status: 400 });
  }

  const challenge = verifyPinChallenge(pinChallengeToken);
  if (!challenge) {
    return NextResponse.json(
      { message: 'ขั้นตอนยืนยัน PIN หมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง' },
      { status: 401 }
    );
  }

  if (!(await isSignInAllowed(request, `pin:${challenge.sub}`))) {
    return NextResponse.json(
      { message: 'พยายามยืนยัน PIN บ่อยเกินไป กรุณาลองใหม่อีกครั้งในภายหลัง' },
      { status: 429 }
    );
  }

  const { data: user } = await supabaseAdmin
    .from('app_users')
    .select('*')
    .eq('id', challenge.sub)
    .single();

  if (!user || user.is_active === false) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง' }, { status: 401 });
  }

  let expectedPin: string;

  if (user.role === 'master_admin') {
    expectedPin = process.env.MASTER_ADMIN_PIN ?? '';
    if (!/^\d{8}$/.test(expectedPin)) {
      console.error('MASTER_ADMIN_PIN must contain exactly 8 digits');
      return NextResponse.json(
        { message: 'ระบบยังไม่ได้กำหนด PIN สำหรับผู้ดูแลระบบ กรุณาติดต่อผู้ดูแลเซิร์ฟเวอร์' },
        { status: 503 }
      );
    }
  } else if (user.role === 'school_admin' && user.school_id) {
    const [{ data: school }, subscription] = await Promise.all([
      supabaseAdmin.from('schools').select('code, is_active').eq('id', user.school_id).maybeSingle(),
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
    expectedPin = school.code;
  } else {
    return NextResponse.json({ message: 'บัญชีนี้ไม่ต้องยืนยัน PIN' }, { status: 400 });
  }

  if (!pinsMatch(String(pin), expectedPin)) {
    return NextResponse.json({ message: 'PIN ไม่ถูกต้อง' }, { status: 401 });
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
