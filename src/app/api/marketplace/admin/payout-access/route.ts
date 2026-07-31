import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { isSignInAllowed } from 'src/lib/auth-rate-limit';
import {
  requireRole,
  signPayoutAccess,
  PAYOUT_ACCESS_COOKIE,
  payoutAccessCookieOptions,
} from 'src/lib/auth-token';

function codesMatch(code: string, expectedCode: string) {
  const actual = Buffer.from(code);
  const expected = Buffer.from(expectedCode);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลการโอนเงิน' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const code = String(body?.code ?? '').trim();
  if (!/^\d{4}$/.test(code)) {
    return NextResponse.json({ message: 'กรุณากรอกรหัสตัวเลข 4 หลัก' }, { status: 400 });
  }

  if (!(await isSignInAllowed(request, `payout-access:${caller.sub}`))) {
    return NextResponse.json(
      { message: 'กรอกรหัสผิดหลายครั้ง กรุณารอสักครู่แล้วลองใหม่' },
      { status: 429 }
    );
  }

  const configuredCode = process.env.MARKETPLACE_PAYOUT_PIN?.trim() ?? '';
  const masterPin = process.env.MASTER_ADMIN_PIN?.trim() ?? '';
  const expectedCode = configuredCode || (/^\d{8}$/.test(masterPin) ? masterPin.slice(-4) : '');
  if (!/^\d{4}$/.test(expectedCode)) {
    return NextResponse.json(
      { message: 'ระบบยังไม่ได้ตั้งรหัสสำหรับหน้าโอนเงิน กรุณาติดต่อผู้ดูแลเซิร์ฟเวอร์' },
      { status: 503 }
    );
  }

  if (!codesMatch(code, expectedCode)) {
    return NextResponse.json({ message: 'รหัสไม่ถูกต้อง' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(
    PAYOUT_ACCESS_COOKIE,
    signPayoutAccess(caller.sub),
    payoutAccessCookieOptions
  );
  return response;
}
