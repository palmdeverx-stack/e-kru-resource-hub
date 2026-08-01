import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

import { CONFIG } from 'src/global-config';
import { sendEmail } from 'src/lib/resend';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { encryptCredential, decryptCredential } from 'src/lib/credential-cipher';

const ONBOARDING_DAYS = 7;

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!
  );
}

export function hashSchoolOnboardingToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSchoolOnboardingForPaidOrders(params: {
  paymentSessionId: string;
  buyerId: string;
  orderIds: string[];
}) {
  const { data: pendingItems, error: itemError } = await supabaseAdmin
    .from('marketplace_order_items')
    .select(
      'id, order:marketplace_orders!inner(id,license_school_id), product:marketplace_products!inner(resource_type,license_scope)'
    )
    .in('order_id', params.orderIds)
    .eq('product.resource_type', 'feature_unlock')
    .in('product.license_scope', ['school', 'teacher'])
    .is('order.license_school_id', null)
    .limit(1);
  if (itemError) throw itemError;
  if (!pendingItems?.length) return false;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('marketplace_school_onboardings')
    .select('id,email,token_ciphertext,email_sent_at')
    .eq('payment_session_id', params.paymentSessionId)
    .maybeSingle();
  if (existingError) throw existingError;

  const { data: buyer, error: buyerError } = await supabaseAdmin
    .from('marketplace_users')
    .select('email,display_name,username')
    .eq('id', params.buyerId)
    .maybeSingle();
  if (buyerError) throw buyerError;
  if (!buyer?.email) throw new Error('ไม่พบอีเมลสำหรับส่งลิงก์สร้างโรงเรียน');
  if (!CONFIG.serverUrl) throw new Error('ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SERVER_URL');

  if (existing?.email_sent_at) return true;

  let token = decryptCredential(existing?.token_ciphertext ?? null);
  let onboardingId = existing?.id;
  if (!token || !onboardingId) {
    token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + ONBOARDING_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const { data: onboarding, error: insertError } = await supabaseAdmin
      .from('marketplace_school_onboardings')
      .insert({
        payment_session_id: params.paymentSessionId,
        buyer_id: params.buyerId,
        email: buyer.email.toLowerCase(),
        token_hash: hashSchoolOnboardingToken(token),
        token_ciphertext: encryptCredential(token),
        expires_at: expiresAt,
      })
      .select('id')
      .single();
    if (insertError || !onboarding) throw insertError ?? new Error('สร้างลิงก์ไม่สำเร็จ');
    onboardingId = onboarding.id;
  }

  const setupUrl = new URL(`/school/setup/${token}`, CONFIG.serverUrl).toString();
  await sendEmail({
      to: buyer.email,
      subject: 'สร้างโรงเรียนเพื่อเปิดใช้งาน License — E-KRU Marketplace',
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto">
          <h2>ชำระเงินสำเร็จแล้ว</h2>
          <p>สวัสดี ${escapeHtml(buyer.display_name || buyer.username)}</p>
          <p>กรุณาสร้างโรงเรียนเพื่อรับ License ที่ซื้อ ระบบจะเริ่มนับอายุ License หลังสร้างโรงเรียนสำเร็จ</p>
          <p style="margin:24px 0">
            <a href="${setupUrl}" style="background:#1565F5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">
              สร้างโรงเรียนและเปิดใช้งาน License
            </a>
          </p>
          <p style="color:#777">ลิงก์นี้มีอายุ ${ONBOARDING_DAYS} วันและใช้ได้ครั้งเดียว</p>
        </div>
      `,
  });
  await supabaseAdmin
    .from('marketplace_school_onboardings')
    .update({ email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', onboardingId);
  return true;
}
