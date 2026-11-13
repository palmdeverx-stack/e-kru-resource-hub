import { z } from 'zod';
import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { writeSecurityAudit } from 'src/lib/security-audit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import { sendEmail, getEmailSender, getEmailReplyTo } from 'src/lib/resend';

import { buildSellerReminderEmail } from 'src/sections/marketplace/admin/server/seller-reminder-email';

type Context = { params: Promise<{ id: string }> };

async function handle(request: Request, context: Context, send: boolean) {
  if (send) {
    const csrfError = rejectCrossSiteMutation(request);
    if (csrfError) return csrfError;
  }
  const caller = requireRole(request, ['master_admin']);
  if (!caller)
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ส่งอีเมลถึงผู้ขาย' }, { status: 403 });
  let testRecipient: string | undefined;
  if (send && request.headers.get('content-type')?.includes('application/json')) {
    const parsed = z
      .object({ mode: z.literal('test'), to: z.string().trim().max(254).email() })
      .strict()
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return NextResponse.json({ message: 'กรุณาระบุอีเมลรับตัวอย่างให้ถูกต้อง' }, { status: 400 });
    testRecipient = parsed.data.to;
  }
  const { id } = await context.params;
  const { data: seller, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, owner_id, owner_role, display_name, seller_name, status, wizard_step')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ message: 'โหลดข้อมูลร้านค้าไม่สำเร็จ' }, { status: 500 });
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });
  if (!['draft', 'rejected'].includes(seller.status)) {
    return NextResponse.json(
      { message: 'ส่งอีเมลเตือนได้เฉพาะร้านที่ยังเป็นแบบร่างหรือรอแก้ไขข้อมูล' },
      { status: 409 }
    );
  }
  const { data: owner, error: ownerError } = await supabaseAdmin
    .from(seller.owner_role === 'marketplace_user' ? 'marketplace_users' : 'app_users')
    .select('email, first_name, last_name')
    .eq('id', seller.owner_id)
    .maybeSingle();
  if (ownerError)
    return NextResponse.json({ message: 'โหลดอีเมลเจ้าของร้านไม่สำเร็จ' }, { status: 500 });
  const to = testRecipient ?? owner?.email?.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json(
      { message: 'บัญชีเจ้าของร้านยังไม่มีอีเมลที่ใช้รับข้อความได้' },
      { status: 400 }
    );
  }
  const template = buildSellerReminderEmail({
    shopName: seller.display_name,
    recipientName:
      `${owner?.first_name ?? ''} ${owner?.last_name ?? ''}`.trim() ||
      seller.seller_name ||
      'ผู้ขาย',
    step: Number(seller.wizard_step ?? 1),
    preview: !send,
    origin: new URL(request.url).origin,
  });
  if (!send)
    return NextResponse.json(
      {
        to,
        fromEmail: getEmailSender(),
        replyTo: getEmailReplyTo() || null,
        ...template,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  const auditSend = (result: 'success' | 'failure' | 'denied', reason?: string) =>
    writeSecurityAudit({
      request,
      actorId: caller.sub,
      actorRole: caller.role,
      actorUsername: caller.username,
      category: 'admin',
      action: testRecipient
        ? 'marketplace.seller_reminder_test_email'
        : 'marketplace.seller_reminder_email',
      targetType: 'marketplace_seller',
      targetId: id,
      result,
      metadata: {
        template: 'seller_issue_resolved',
        wizard_step: seller.wizard_step,
        provider: process.env.EMAIL_PROVIDER === 'gmail' ? 'gmail' : 'resend',
        ...(reason && { reason }),
      },
    });
  if (!getEmailSender()) {
    await auditSend('failure', 'sender_not_configured');
    return NextResponse.json({ message: 'กรุณาตั้งค่าอีเมลผู้ส่งก่อนส่ง' }, { status: 503 });
  }
  const allowed = await isActionAllowed({
    request,
    action: testRecipient ? 'seller-reminder-test' : `seller-reminder:${id}`,
    subject: testRecipient ? caller.sub : id,
    maxAttempts: 1,
    windowSeconds: 300,
  });
  if (!allowed) {
    await auditSend('denied', 'rate_limit');
    return NextResponse.json(
      {
        message:
          'ระบบจำกัดความถี่การส่ง กรุณารอ 5 นาทีแล้วลองใหม่ ข้อความนี้ไม่ยืนยันว่ารอบก่อนส่งสำเร็จ',
      },
      { status: 429 }
    );
  }
  try {
    await sendEmail({
      to,
      subject: testRecipient ? `[ตัวอย่าง] ${template.subject}` : template.subject,
      html: template.html,
      inlineLogo: true,
      replyTo: getEmailReplyTo(),
    });
  } catch (mailError) {
    const code =
      mailError && typeof mailError === 'object' && 'providerCode' in mailError
        ? String(mailError.providerCode)
        : 'unknown';
    const messages: Record<string, string> = {
      gmail_configuration_error: 'กรุณาตั้งค่า GMAIL_USER และ GMAIL_APP_PASSWORD',
      gmail_auth_error:
        'Gmail ปฏิเสธการเข้าสู่ระบบ กรุณาตรวจ App password และเปิดการยืนยันสองขั้นตอน',
      gmail_send_error: 'Gmail ส่งไม่สำเร็จ กรุณาตรวจการเชื่อมต่อ โควตา และอีเมลผู้รับ',
      validation_error:
        'Resend ไม่ยอมรับอีเมลผู้ส่งหรือผู้รับ กรุณาตรวจสอบโดเมนที่ยืนยันและรูปแบบอีเมล',
      restricted_api_key: 'API key ของ Resend ไม่มีสิทธิ์ส่งจากโดเมนนี้ กรุณาตรวจสอบสิทธิ์ของคีย์',
      invalid_api_key: 'API key ของ Resend ไม่ถูกต้อง กรุณาแก้ไขค่าใน Vercel และ Redeploy',
      missing_api_key: 'ยังไม่ได้ตั้งค่า API key ของ Resend ใน deployment นี้',
      rate_limit_exceeded: 'Resend จำกัดการส่งชั่วคราว กรุณารอสักครู่แล้วลองใหม่',
      daily_quota_exceeded: 'ใช้โควตาส่งอีเมลรายวันของ Resend ครบแล้ว',
      monthly_quota_exceeded: 'ใช้โควตาส่งอีเมลรายเดือนของ Resend ครบแล้ว',
    };
    await auditSend('failure', Object.hasOwn(messages, code) ? code : 'unknown');
    console.error('Seller reminder email failed', {
      sellerId: id,
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
  await auditSend('success', 'provider_accepted');
  return NextResponse.json({
    message: 'ผู้ให้บริการรับคำขอส่งอีเมลแล้ว กรุณาตรวจกล่องจดหมายและสแปมของผู้รับ',
  });
}
export async function GET(request: Request, context: Context) {
  return handle(request, context, false);
}
export async function POST(request: Request, context: Context) {
  return handle(request, context, true);
}
