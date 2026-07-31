import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { createNotifications } from 'src/lib/notifications';
import { decryptLineCredential } from 'src/lib/line-credentials';

export type MarketplaceLineEvent = 'new_seller' | 'product_approval';

type NotificationInput = {
  event: MarketplaceLineEvent;
  sourceId: string;
  message: string;
  actionUrl: string;
  title?: string;
};

export async function notifyMarketplaceAdmins({
  event,
  sourceId,
  message,
  actionUrl,
  title,
}: NotificationInput) {
  const { data: admins } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .in('role', ['master_admin', 'super_admin'])
    .eq('is_active', true);

  await createNotifications(
    (admins ?? []).map((admin) => ({
      userId: admin.id,
      schoolId: null,
      type: event === 'new_seller' ? 'marketplace_seller_request' : 'marketplace_product_approval',
      title: title ?? (event === 'new_seller' ? 'มีคำขอเปิดร้านใหม่' : 'มีสินค้ารออนุมัติ'),
      body: message.replace(/^[^\n]*\n?/, ''),
      link: new URL(actionUrl).pathname,
    }))
  );

  const { data: settings } = await supabaseAdmin
    .from('marketplace_line_settings')
    .select(
      'is_enabled, notify_new_seller, notify_product_approval, channel_access_token_encrypted, line_user_id'
    )
    .eq('id', 'default')
    .maybeSingle();

  const eventEnabled =
    event === 'new_seller' ? settings?.notify_new_seller : settings?.notify_product_approval;
  if (
    !settings?.is_enabled ||
    !eventEnabled ||
    !settings.channel_access_token_encrypted ||
    !settings.line_user_id
  ) {
    return;
  }

  const messageText = `${message}\n\nตรวจสอบรายการ: ${actionUrl}`;
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

  await supabaseAdmin.from('marketplace_line_deliveries').insert({
    event_type: event,
    source_id: sourceId,
    message_text: messageText,
    status,
    line_user_id: settings.line_user_id,
    last_error: lastError,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  });
}
