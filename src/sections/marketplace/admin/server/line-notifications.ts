import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { createNotifications } from 'src/lib/notifications';
import { decryptLineCredential } from 'src/lib/line-credentials';

export type MarketplaceLineEvent = 'new_seller' | 'product_approval' | 'payout_due';

type NotificationInput = {
  event: MarketplaceLineEvent;
  sourceId: string;
  message: string;
  actionUrl: string;
  title?: string;
  dedupeKey?: string;
};

const EVENT_CONFIG = {
  new_seller: {
    notificationType: 'marketplace_seller_request',
    defaultTitle: 'มีคำขอเปิดร้านใหม่',
    setting: 'notify_new_seller',
  },
  product_approval: {
    notificationType: 'marketplace_product_approval',
    defaultTitle: 'มีสินค้ารออนุมัติ',
    setting: 'notify_product_approval',
  },
  payout_due: {
    notificationType: 'marketplace_payout_due',
    defaultTitle: 'ถึงวันทำรอบโอนเงิน',
    setting: 'notify_payout_due',
  },
} as const;

export async function notifyMarketplaceAdmins({
  event,
  sourceId,
  message,
  actionUrl,
  title,
  dedupeKey,
}: NotificationInput) {
  const config = EVENT_CONFIG[event];
  const messageText = `${message}\n\nตรวจสอบรายการ: ${actionUrl}`;
  let deliveryId: string | null = null;

  if (dedupeKey) {
    const { data: claimedDelivery, error: claimError } = await supabaseAdmin
      .from('marketplace_line_deliveries')
      .insert({
        event_type: event,
        source_id: sourceId || null,
        dedupe_key: dedupeKey,
        message_text: messageText,
        status: 'processing',
      })
      .select('id')
      .single();

    if (claimError) {
      if (claimError.code === '23505') return { status: 'duplicate' as const };
      throw claimError;
    }
    deliveryId = claimedDelivery.id;
  }

  const { data: admins } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .in(
      'role',
      event === 'payout_due' ? ['master_admin'] : ['master_admin', 'marketplace_admin']
    )
    .eq('is_active', true);

  await createNotifications(
    (admins ?? []).map((admin) => ({
      userId: admin.id,
      schoolId: null,
      type: config.notificationType,
      title: title ?? config.defaultTitle,
      body: message.replace(/^[^\n]*\n?/, ''),
      link: new URL(actionUrl).pathname,
    }))
  );

  const { data: settings } = await supabaseAdmin
    .from('marketplace_line_settings')
    .select(
      'is_enabled, notify_new_seller, notify_product_approval, notify_payout_due, channel_access_token_encrypted, line_user_id'
    )
    .eq('id', 'default')
    .maybeSingle();

  const eventEnabled = settings?.[config.setting];
  if (
    !settings?.is_enabled ||
    !eventEnabled ||
    !settings.channel_access_token_encrypted ||
    !settings.line_user_id
  ) {
    if (deliveryId) {
      await supabaseAdmin
        .from('marketplace_line_deliveries')
        .update({
          status: 'skipped',
          last_error: 'ปิดการแจ้งเตือน หรือยังไม่ได้ผูกบัญชี LINE ผู้รับ',
        })
        .eq('id', deliveryId);
    }
    return { status: 'skipped' as const };
  }

  let status: 'sent' | 'failed' = 'failed';
  let lastError: string | null = null;

  try {
    const accessToken = decryptLineCredential(settings.channel_access_token_encrypted);
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: settings.line_user_id,
        messages: [{ type: 'text', text: messageText }],
      }),
    });
    status = response.ok ? 'sent' : 'failed';
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      lastError = result?.message ?? `LINE API ${response.status}`;
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'ไม่สามารถส่ง LINE ได้';
  }

  const delivery = {
    event_type: event,
    source_id: sourceId || null,
    message_text: messageText,
    status,
    line_user_id: settings.line_user_id,
    last_error: lastError,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  };
  if (deliveryId) {
    await supabaseAdmin.from('marketplace_line_deliveries').update(delivery).eq('id', deliveryId);
  } else {
    await supabaseAdmin.from('marketplace_line_deliveries').insert(delivery);
  }

  return { status };
}
