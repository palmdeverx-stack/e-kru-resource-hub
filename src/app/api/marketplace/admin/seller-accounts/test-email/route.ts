import { z } from 'zod';
import { NextResponse } from 'next/server';

import { sendEmail } from 'src/lib/resend';
import { requireRole } from 'src/lib/auth-token';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { writeSecurityAudit } from 'src/lib/security-audit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { buildSellerReminderEmail } from 'src/sections/marketplace/admin/server/seller-reminder-email';

function templateFor(request: Request) {
  return buildSellerReminderEmail({
    shopName: 'ร้านค้าตัวอย่าง',
    recipientName: 'ผู้ทดสอบ',
    step: 1,
    origin: new URL(request.url).origin,
  });
}
export async function GET(request: Request) {
  if (!requireRole(request, ['master_admin']))
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ส่งอีเมลทดสอบ' }, { status: 403 });
  return NextResponse.json(
    {
      ...templateFor(request),
      to: '',
      fromEmail: process.env.RESEND_FROM_EMAIL?.trim() || null,
      replyTo: process.env.RESEND_REPLY_TO_EMAIL?.trim() || null,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireRole(request, ['master_admin']);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์ส่งอีเมลทดสอบ' }, { status: 403 });
  const parsed = z
    .object({ mode: z.literal('test'), to: z.string().trim().max(254).email() })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ message: 'กรุณาระบุอีเมลรับตัวอย่างให้ถูกต้อง' }, { status: 400 });
  if (!process.env.RESEND_FROM_EMAIL?.trim())
    return NextResponse.json(
      { message: 'กรุณาตั้งค่า RESEND_FROM_EMAIL ก่อนส่ง' },
      { status: 503 }
    );
  const allowed = await isActionAllowed({
    request,
    action: 'seller-reminder-test',
    subject: caller.sub,
    maxAttempts: 1,
    windowSeconds: 300,
  });
  if (!allowed)
    return NextResponse.json({ message: 'กรุณารอ 5 นาทีก่อนส่งตัวอย่างซ้ำ' }, { status: 429 });
  const template = templateFor(request);
  try {
    await sendEmail({
      to: parsed.data.to,
      subject: `[ตัวอย่าง] ${template.subject}`,
      html: template.html,
      replyTo: process.env.RESEND_REPLY_TO_EMAIL?.trim() || undefined,
    });
  } catch (mailError) {
    const code =
      mailError && typeof mailError === 'object' && 'providerCode' in mailError
        ? String(mailError.providerCode)
        : 'unknown';
    const messages: Record<string, string> = {
      validation_error:
        'Resend ไม่ยอมรับอีเมลผู้ส่งหรือผู้รับ กรุณาตรวจสอบโดเมนที่ยืนยันและรูปแบบอีเมล',
      restricted_api_key: 'API key ของ Resend ไม่มีสิทธิ์ส่งจากโดเมนนี้ กรุณาตรวจสอบสิทธิ์ของคีย์',
      invalid_api_key: 'API key ของ Resend ไม่ถูกต้อง กรุณาแก้ไขค่าใน Vercel และ Redeploy',
      missing_api_key: 'ยังไม่ได้ตั้งค่า API key ของ Resend ใน deployment นี้',
      rate_limit_exceeded: 'Resend จำกัดการส่งชั่วคราว กรุณารอสักครู่แล้วลองใหม่',
      daily_quota_exceeded: 'ใช้โควตาส่งอีเมลรายวันของ Resend ครบแล้ว',
      monthly_quota_exceeded: 'ใช้โควตาส่งอีเมลรายเดือนของ Resend ครบแล้ว',
    };
    console.error('Seller reminder email failed', {
      action: 'seller-reminder-test',
      providerCode: Object.hasOwn(messages, code) ? code : 'unknown',
      apiKeyConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
    });
    return NextResponse.json(
      {
        message: Object.hasOwn(messages, code)
          ? messages[code]
          : 'ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบการตั้งค่าอีเมลและลองใหม่ภายหลัง',
      },
      { status: 502 }
    );
  }
  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorRole: caller.role,
    actorUsername: caller.username,
    category: 'admin',
    action: 'marketplace.seller_reminder_test_email',
    result: 'success',
    metadata: { template: 'seller_issue_resolved' },
  });
  return NextResponse.json({ message: 'Resend รับคำขอส่งตัวอย่างแล้ว' });
}
