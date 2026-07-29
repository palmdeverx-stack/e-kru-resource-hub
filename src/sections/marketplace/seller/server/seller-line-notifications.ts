import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { decryptLineCredential } from 'src/lib/line-credentials';

type PushLineTextInput = {
  accessToken: string;
  lineUserId: string;
  message: string;
};

type PaymentNotificationInput = {
  sellerId: string;
  orderId: string;
  paymentSessionId: string;
  grossAmount: number;
  sellerNet: number;
  availableAt: string;
};

export async function pushSellerLineText({
  accessToken,
  lineUserId,
  message,
}: PushLineTextInput) {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text: message }],
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.message ?? `LINE API ${response.status}`);
  }
}

function formatBaht(value: number) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
  }).format(value);
}

export async function notifySellerPaymentReceived(input: PaymentNotificationInput) {
  const [{ data: access }, { data: settings }] = await Promise.all([
    supabaseAdmin
      .from('marketplace_line_settings')
      .select('allow_seller_notifications')
      .eq('id', 'default')
      .maybeSingle(),
    supabaseAdmin
      .from('marketplace_seller_line_settings')
      .select(
        'is_enabled, notify_payment_received, channel_access_token_encrypted, line_user_id'
      )
      .eq('seller_id', input.sellerId)
      .maybeSingle(),
  ]);

  if (
    !access?.allow_seller_notifications ||
    !settings?.is_enabled ||
    !settings.notify_payment_received ||
    !settings.channel_access_token_encrypted ||
    !settings.line_user_id
  ) {
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from('marketplace_seller_line_deliveries')
    .select('id, status')
    .eq('order_id', input.orderId)
    .eq('event_type', 'payment_received')
    .maybeSingle();
  if (existing) return;

  const message = [
    '💰 E-KRU Marketplace',
    'ยืนยันการชำระเงินจากผู้ซื้อแล้ว',
    '',
    `ยอดขาย: ${formatBaht(input.grossAmount)}`,
    `รายรับหลังค่าธรรมเนียม: ${formatBaht(input.sellerNet)}`,
    `คำสั่งซื้อ: #${input.orderId.slice(0, 8).toUpperCase()}`,
    `ยอดพร้อมโอน: ${new Date(input.availableAt).toLocaleDateString('th-TH', {
      timeZone: 'Asia/Bangkok',
    })}`,
    '',
    'หมายเหตุ: เป็นยอดที่แพลตฟอร์มรับชำระแล้ว เงินจะโอนเข้าบัญชีตามรอบที่กำหนด',
  ].join('\n');

  // Reserve the order/event before calling LINE so concurrent Stripe webhooks
  // cannot send the same seller notification twice.
  const { data: delivery, error: reserveError } = await supabaseAdmin
    .from('marketplace_seller_line_deliveries')
    .insert({
      seller_id: input.sellerId,
      order_id: input.orderId,
      payment_session_id: input.paymentSessionId,
      event_type: 'payment_received',
      amount: input.sellerNet,
      message_text: message,
      status: 'failed',
      last_error: 'กำลังส่ง',
    })
    .select('id')
    .single();
  if (reserveError || !delivery) return;

  let status: 'sent' | 'failed' = 'failed';
  let lastError: string | null = null;
  try {
    await pushSellerLineText({
      accessToken: decryptLineCredential(settings.channel_access_token_encrypted),
      lineUserId: settings.line_user_id,
      message,
    });
    status = 'sent';
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'ไม่สามารถส่ง LINE ได้';
  }

  await supabaseAdmin
    .from('marketplace_seller_line_deliveries')
    .update({
      status,
      last_error: lastError,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    })
    .eq('id', delivery.id);
}
