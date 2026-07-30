import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { decryptLineCredential } from 'src/lib/line-credentials';

import { getSellerLineFeatureAccess } from './seller-line-access';
import { recordEntitlementUsage } from '../../checkout/server/order-evidence';
import {
  MARKETPLACE_SELLER_LINE_FEATURE_KEY,
  MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY,
} from '../line-feature';

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

export async function pushSellerLineText({ accessToken, lineUserId, message }: PushLineTextInput) {
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
  const [{ data: seller }, { data: settings }, { data: globalSettings }] = await Promise.all([
    supabaseAdmin
      .from('marketplace_sellers')
      .select('owner_id, owner_role')
      .eq('id', input.sellerId)
      .maybeSingle(),
    supabaseAdmin
      .from('marketplace_seller_line_settings')
      .select('is_enabled, notify_payment_received, channel_access_token_encrypted, line_user_id')
      .eq('seller_id', input.sellerId)
      .maybeSingle(),
    supabaseAdmin
      .from('marketplace_line_settings')
      .select('is_enabled, channel_access_token_encrypted, line_user_id')
      .eq('id', 'default')
      .maybeSingle(),
  ]);

  if (!seller) return;
  const access = await getSellerLineFeatureAccess(seller.owner_id, seller.owner_role);
  const { data: featureLicenses } = await supabaseAdmin
    .from('marketplace_user_licenses')
    .select(
      'order_id,order_item_id,product_id,feature_keys,created_at,product:marketplace_products(license_line_quota)'
    )
    .eq('buyer_id', seller.owner_id)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .overlaps('feature_keys', [
      MARKETPLACE_SELLER_LINE_FEATURE_KEY,
      MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY,
    ])
    .order('created_at', { ascending: false });

  const ownLicense = featureLicenses?.find((license) =>
    license.feature_keys?.includes(MARKETPLACE_SELLER_LINE_FEATURE_KEY)
  );
  const managedLicense = featureLicenses?.find((license) =>
    license.feature_keys?.includes(MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY)
  );
  const isSystemSeller = seller.owner_role === 'master_admin' || seller.owner_role === 'super_admin';
  const systemSellerUsesOwnAccount = Boolean(
    isSystemSeller &&
      settings?.is_enabled &&
      settings.channel_access_token_encrypted &&
      settings.line_user_id
  );
  const useOwnAccount = Boolean(settings?.channel_access_token_encrypted && ownLicense);
  const featureLicense = useOwnAccount ? ownLicense : managedLicense;
  const encryptedAccessToken = isSystemSeller
    ? systemSellerUsesOwnAccount
      ? settings?.channel_access_token_encrypted
      : globalSettings?.channel_access_token_encrypted
    : useOwnAccount
      ? settings?.channel_access_token_encrypted
      : managedLicense
        ? globalSettings?.channel_access_token_encrypted
        : null;
  const lineUserId =
    isSystemSeller && !systemSellerUsesOwnAccount
      ? globalSettings?.line_user_id
      : settings?.line_user_id;
  const notificationsEnabled = isSystemSeller
    ? systemSellerUsesOwnAccount || globalSettings?.is_enabled === true
    : settings?.is_enabled === true;

  let skipReason: string | null = null;
  if (!access.allowed) skipReason = 'ผู้ดูแลระบบยังไม่เปิดใช้ LINE แจ้งเตือนร้านค้า';
  else if (!access.entitled) skipReason = 'ไม่พบสิทธิ์ใช้งาน LINE แจ้งเตือนที่ยังใช้งานได้';
  else if (!notificationsEnabled) skipReason = 'ร้านค้าปิดการแจ้งเตือน LINE ไว้';
  else if (settings?.notify_payment_received === false)
    skipReason = 'ร้านค้าปิดรายการแจ้งเตือนเมื่อรับชำระเงิน';
  else if (!encryptedAccessToken)
    skipReason =
      managedLicense || isSystemSeller
        ? 'ยังไม่ได้ตั้งค่า Channel access token ของ LINE OA ระบบ'
        : 'ยังไม่ได้ตั้งค่า Channel access token ของร้าน';
  else if (!lineUserId) skipReason = 'ยังไม่ได้ผูก LINE ผู้รับแจ้งเตือน';

  if (!skipReason && managedLicense && !useOwnAccount) {
    const managedProduct = managedLicense.product as
      | Array<{ license_line_quota: number | null }>
      | null;
    const quota = Number(managedProduct?.[0]?.license_line_quota);
    if (Number.isFinite(quota) && quota > 0) {
      const { count } = await supabaseAdmin
        .from('marketplace_entitlement_usage_events')
        .select('id', { count: 'exact', head: true })
        .eq('buyer_id', seller.owner_id)
        .eq('order_item_id', managedLicense.order_item_id)
        .eq('event_type', 'seller_line_notification_sent');
      if ((count ?? 0) >= quota) skipReason = `โควต้า LINE ของระบบครบ ${quota} ข้อความแล้ว`;
    }
  }

  const { data: existing } = await supabaseAdmin
    .from('marketplace_seller_line_deliveries')
    .select('id, status')
    .eq('order_id', input.orderId)
    .eq('event_type', 'payment_received')
    .maybeSingle();
  if (existing?.status === 'sent') return;

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
  const deliveryPayload = {
      seller_id: input.sellerId,
      order_id: input.orderId,
      payment_session_id: input.paymentSessionId,
      event_type: 'payment_received',
      amount: input.sellerNet,
      message_text: message,
      status: 'failed',
      last_error: skipReason ?? 'กำลังส่ง',
    };
  const reservation = existing
    ? await supabaseAdmin
        .from('marketplace_seller_line_deliveries')
        .update(deliveryPayload)
        .eq('id', existing.id)
        .select('id')
        .single()
    : await supabaseAdmin
        .from('marketplace_seller_line_deliveries')
        .insert(deliveryPayload)
        .select('id')
        .single();
  const { data: delivery, error: reserveError } = reservation;
  if (reserveError || !delivery) return;
  if (skipReason || !encryptedAccessToken || !lineUserId) return;

  let status: 'sent' | 'failed' = 'failed';
  let lastError: string | null = null;
  try {
    await pushSellerLineText({
      accessToken: decryptLineCredential(encryptedAccessToken),
      lineUserId,
      message,
    });
    status = 'sent';
    if (featureLicense) {
      await recordEntitlementUsage({
        buyerId: seller.owner_id,
        eventType: 'seller_line_notification_sent',
        orderId: featureLicense.order_id,
        orderItemId: featureLicense.order_item_id,
        productId: featureLicense.product_id,
        featureKey: featureLicense.feature_keys?.[0] ?? null,
        metadata: {
          notified_order_id: input.orderId,
          payment_session_id: input.paymentSessionId,
        },
      }).catch((usageError) => {
        console.error('Failed to record seller LINE entitlement usage', usageError);
      });
    }
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
