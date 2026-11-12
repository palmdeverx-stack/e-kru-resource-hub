import { NextResponse } from 'next/server';

import { sendEmail } from 'src/lib/resend';
import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { writeSecurityAudit } from 'src/lib/security-audit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

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
  const to = owner?.email?.trim();
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
    origin: new URL(request.url).origin,
  });
  if (!send)
    return NextResponse.json(
      {
        to,
        fromEmail: process.env.RESEND_FROM_EMAIL?.trim() || null,
        replyTo: process.env.RESEND_REPLY_TO_EMAIL?.trim() || null,
        ...template,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  if (!process.env.RESEND_FROM_EMAIL?.trim())
    return NextResponse.json(
      { message: 'กรุณาตั้งค่า RESEND_FROM_EMAIL เป็นอีเมลจากโดเมนที่ยืนยันใน Resend ก่อนส่ง' },
      { status: 503 }
    );
  const allowed = await isActionAllowed({
    request,
    action: `seller-reminder:${id}`,
    subject: id,
    maxAttempts: 1,
    windowSeconds: 300,
  });
  if (!allowed)
    return NextResponse.json(
      { message: 'เพิ่งส่งอีเมลถึงร้านนี้ กรุณารอ 5 นาทีก่อนส่งซ้ำ' },
      { status: 429 }
    );
  try {
    await sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      replyTo: process.env.RESEND_REPLY_TO_EMAIL?.trim() || undefined,
    });
  } catch {
    return NextResponse.json(
      { message: 'ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบการตั้งค่าอีเมลและลองใหม่ภายหลัง' },
      { status: 502 }
    );
  }
  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorRole: caller.role,
    actorUsername: caller.username,
    category: 'admin',
    action: 'marketplace.seller_reminder_email',
    targetType: 'marketplace_seller',
    targetId: id,
    result: 'success',
    metadata: { template: 'seller_issue_resolved', wizard_step: seller.wizard_step },
  });
  return NextResponse.json({ message: 'ส่งอีเมลแจ้งแก้ไขปัญหาและเชิญเปิดร้านต่อแล้ว' });
}
export async function GET(request: Request, context: Context) {
  return handle(request, context, false);
}
export async function POST(request: Request, context: Context) {
  return handle(request, context, true);
}
