import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import { encryptLineCredential, decryptLineCredential } from 'src/lib/line-credentials';

import { MARKETPLACE_MINIMUM_PAID_PRICE_THB } from 'src/sections/marketplace/shared/payment';
import { syncSellerLineFeatureProducts } from 'src/sections/marketplace/seller/server/seller-line-product';

const TEST_NOTIFICATION_MESSAGES = {
  new_seller: [
    '🧪 ทดสอบ: มีคำขอเปิดร้านใหม่',
    'ร้านตัวอย่าง: ห้องเรียนสร้างสรรค์',
    'ประเภทผู้ขาย: บุคคลทั่วไป',
    'กรุณาตรวจสอบข้อมูลและเอกสารของผู้สมัคร',
  ].join('\n'),
  product_approval: [
    '🧪 ทดสอบ: มีสินค้ารออนุมัติ',
    'สินค้า: แบบฝึกทักษะคณิตศาสตร์ ป.4',
    'ร้านค้า: ห้องเรียนสร้างสรรค์',
    'กรุณาตรวจสอบรายละเอียดและไฟล์สินค้า',
  ].join('\n'),
  payout_due: [
    '🧪 ทดสอบ: ถึงวันทำรอบโอนเงินผู้ขาย',
    'พร้อมสร้างรอบ 3 ร้าน รวม ฿12,450.00',
    'รอยืนยันการโอน 1 รายการ รวม ฿2,100.00',
    'ต้องตรวจสอบบัญชีหรือยอดขั้นต่ำ 1 ร้าน',
  ].join('\n'),
} as const;

type TestNotificationEvent = keyof typeof TEST_NOTIFICATION_MESSAGES;

function authorize(request: Request) {
  return requireRole(request, ['master_admin']);
}

function withTrailingSlash(value: string) {
  return `${value.replace(/\/+$/, '')}/`;
}

async function loadLineQuota(encryptedAccessToken: string | null | undefined) {
  if (!encryptedAccessToken) {
    return {
      type: 'unavailable' as const,
      limit: null,
      used: 0,
      remaining: null,
      error: 'ยังไม่ได้บันทึก Channel access token',
    };
  }

  try {
    const accessToken = decryptLineCredential(encryptedAccessToken);
    const headers = { Authorization: `Bearer ${accessToken}` };
    const [quotaResponse, consumptionResponse] = await Promise.all([
      fetch('https://api.line.me/v2/bot/message/quota', { headers, cache: 'no-store' }),
      fetch('https://api.line.me/v2/bot/message/quota/consumption', {
        headers,
        cache: 'no-store',
      }),
    ]);
    if (!quotaResponse.ok || !consumptionResponse.ok) {
      const result = await (quotaResponse.ok ? consumptionResponse : quotaResponse)
        .json()
        .catch(() => null);
      throw new Error(result?.message ?? 'LINE ไม่สามารถส่งข้อมูลโควตาได้');
    }

    const quota = (await quotaResponse.json()) as { type: 'none' | 'limited'; value?: number };
    const consumption = (await consumptionResponse.json()) as { totalUsage: number };
    const used = Math.max(0, Number(consumption.totalUsage) || 0);
    const limit = quota.type === 'limited' ? Math.max(0, Number(quota.value) || 0) : null;

    return {
      type: quota.type,
      limit,
      used,
      remaining: limit === null ? null : Math.max(0, limit - used),
      error: null,
    };
  } catch (error) {
    return {
      type: 'unavailable' as const,
      limit: null,
      used: 0,
      remaining: null,
      error: error instanceof Error ? error.message : 'โหลดโควตา LINE ไม่สำเร็จ',
    };
  }
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตั้งค่า LINE Marketplace' }, { status: 403 });
  }

  const [{ data: settings, error }, { data: recentDeliveries }] = await Promise.all([
    supabaseAdmin.from('marketplace_line_settings').select('*').eq('id', 'default').maybeSingle(),
    supabaseAdmin
      .from('marketplace_line_deliveries')
      .select('id, event_type, status, last_error, created_at, sent_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  const quota = await loadLineQuota(settings?.channel_access_token_encrypted);

  return NextResponse.json({
    integration: {
      channelId: settings?.channel_id ?? '',
      oaBasicId: settings?.oa_basic_id ?? '',
      isEnabled: settings?.is_enabled ?? false,
      hasChannelSecret: Boolean(settings?.channel_secret_encrypted),
      hasAccessToken: Boolean(settings?.channel_access_token_encrypted),
      notifyNewSeller: settings?.notify_new_seller ?? true,
      notifyProductApproval: settings?.notify_product_approval ?? true,
      notifyPayoutDue: settings?.notify_payout_due ?? true,
      allowSellerNotifications: settings?.allow_seller_notifications ?? false,
      sellerNotificationPrice: Number(settings?.seller_notification_price ?? 99),
      sellerByoaDescription: settings?.seller_byoa_description ?? '',
      sellerManagedPrice: Number(settings?.seller_managed_price ?? 99),
      sellerManagedDescription: settings?.seller_managed_description ?? '',
      sellerManagedQuota: Number(settings?.seller_managed_quota ?? 100),
      sellerTrialDescription:
        settings?.seller_trial_description ??
        'ทดลองใช้ LINE แจ้งเตือนผ่าน OA ของระบบ E-KRU ฟรี 7 วัน',
      sellerTrialDays: Number(settings?.seller_trial_days ?? 7),
      sellerTrialQuota: Number(settings?.seller_trial_quota ?? 10),
      lineDisplayName: settings?.line_display_name ?? null,
      lineLinkedAt: settings?.line_linked_at ?? null,
    },
    webhookUrl: withTrailingSlash(
      settings?.webhook_url ?? `${new URL(request.url).origin}/api/line/marketplace/webhook`
    ),
    invitation: null,
    quota,
    recentDeliveries: recentDeliveries ?? [],
  });
}

export async function PATCH(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = authorize(request);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตั้งค่า LINE Marketplace' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const channelId = String(body?.channelId ?? '').trim();
  const rawOaBasicId = String(body?.oaBasicId ?? '').trim();
  const oaBasicId = rawOaBasicId ? `@${rawOaBasicId.replace(/^@+/, '')}` : '';
  const webhookUrl = String(body?.webhookUrl ?? '').trim();
  const channelSecret = String(body?.channelSecret ?? '').trim();
  const accessToken = String(body?.accessToken ?? '').trim();
  const isEnabled = body?.isEnabled === true;
  const sellerNotificationPrice = Number(body?.sellerNotificationPrice);
  const sellerByoaDescription = String(body?.sellerByoaDescription ?? '').trim();
  const sellerManagedPrice = Number(body?.sellerManagedPrice);
  const sellerManagedDescription = String(body?.sellerManagedDescription ?? '').trim();
  const sellerManagedQuota = Number(body?.sellerManagedQuota);
  const sellerTrialDescription = String(body?.sellerTrialDescription ?? '').trim();
  const sellerTrialDays = Number(body?.sellerTrialDays);
  const sellerTrialQuota = Number(body?.sellerTrialQuota);
  const expectedPath = '/api/line/marketplace/webhook';

  let parsedWebhook: URL | null = null;
  try {
    parsedWebhook = webhookUrl ? new URL(webhookUrl) : null;
  } catch {
    parsedWebhook = null;
  }

  if (
    !channelId ||
    channelId.length > 100 ||
    oaBasicId.length > 100 ||
    channelSecret.length > 500 ||
    accessToken.length > 2000 ||
    !parsedWebhook ||
    parsedWebhook.protocol !== 'https:' ||
    parsedWebhook.pathname.replace(/\/+$/, '') !== expectedPath ||
    Boolean(parsedWebhook.search || parsedWebhook.hash) ||
    typeof body?.notifyNewSeller !== 'boolean' ||
    typeof body?.notifyProductApproval !== 'boolean' ||
    typeof body?.notifyPayoutDue !== 'boolean' ||
    typeof body?.allowSellerNotifications !== 'boolean' ||
    !Number.isFinite(sellerNotificationPrice) ||
    sellerNotificationPrice < MARKETPLACE_MINIMUM_PAID_PRICE_THB ||
    !sellerByoaDescription ||
    !Number.isFinite(sellerManagedPrice) ||
    sellerManagedPrice < MARKETPLACE_MINIMUM_PAID_PRICE_THB ||
    !sellerManagedDescription ||
    !Number.isInteger(sellerManagedQuota) ||
    sellerManagedQuota <= 0 ||
    !sellerTrialDescription ||
    !Number.isInteger(sellerTrialDays) ||
    sellerTrialDays <= 0 ||
    !Number.isInteger(sellerTrialQuota) ||
    sellerTrialQuota <= 0
  ) {
    return NextResponse.json({ message: 'ข้อมูลการเชื่อมต่อ LINE ไม่ถูกต้อง' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('marketplace_line_settings')
    .select('channel_secret_encrypted, channel_access_token_encrypted, line_user_id')
    .eq('id', 'default')
    .maybeSingle();

  const hasChannelSecret = Boolean(channelSecret || existing?.channel_secret_encrypted);
  const hasAccessToken = Boolean(accessToken || existing?.channel_access_token_encrypted);
  if (isEnabled && (!hasChannelSecret || !hasAccessToken)) {
    return NextResponse.json(
      { message: 'กรุณาบันทึก Channel secret และ Channel access token ก่อนเปิดใช้งาน' },
      { status: 400 }
    );
  }
  const requiresLineLink = isEnabled && !existing?.line_user_id;

  const { error } = await supabaseAdmin.from('marketplace_line_settings').upsert(
    {
      id: 'default',
      channel_id: channelId,
      oa_basic_id: oaBasicId || null,
      webhook_url: `${parsedWebhook.origin}${expectedPath}/`,
      is_enabled: isEnabled && !requiresLineLink,
      notify_new_seller: body.notifyNewSeller,
      notify_product_approval: body.notifyProductApproval,
      notify_payout_due: body.notifyPayoutDue,
      allow_seller_notifications: body.allowSellerNotifications,
      seller_notification_price: sellerNotificationPrice,
      seller_byoa_description: sellerByoaDescription,
      seller_managed_price: sellerManagedPrice,
      seller_managed_description: sellerManagedDescription,
      seller_managed_quota: sellerManagedQuota,
      seller_trial_description: sellerTrialDescription,
      seller_trial_days: sellerTrialDays,
      seller_trial_quota: sellerTrialQuota,
      ...(channelSecret && { channel_secret_encrypted: encryptLineCredential(channelSecret) }),
      ...(accessToken && { channel_access_token_encrypted: encryptLineCredential(accessToken) }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  try {
    await syncSellerLineFeatureProducts({
      adminUserId: caller.sub,
      enabled: body.allowSellerNotifications,
      byoa: { price: sellerNotificationPrice, description: sellerByoaDescription },
      managed: {
        price: sellerManagedPrice,
        description: sellerManagedDescription,
        quota: sellerManagedQuota,
      },
      trial: {
        description: sellerTrialDescription,
        durationDays: sellerTrialDays,
        quota: sellerTrialQuota,
      },
    });
  } catch (syncError) {
    return NextResponse.json(
      {
        message:
          syncError instanceof Error
            ? `บันทึกการตั้งค่าแล้ว แต่เตรียมสินค้าฟีเจอร์ไม่สำเร็จ: ${syncError.message}`
            : 'บันทึกการตั้งค่าแล้ว แต่เตรียมสินค้าฟีเจอร์ไม่สำเร็จ',
      },
      { status: 500 }
    );
  }
  return NextResponse.json({
    success: true,
    requiresLineLink,
    message: requiresLineLink
      ? 'บันทึก Credentials แล้ว กรุณาสร้างรหัสและผูกบัญชี LINE ผู้รับก่อนเปิดแจ้งเตือน'
      : 'บันทึกการตั้งค่าเรียบร้อยแล้ว',
  });
}

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = authorize(request);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตั้งค่า LINE Marketplace' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);

  const { data: settings } = await supabaseAdmin
    .from('marketplace_line_settings')
    .select('oa_basic_id, channel_access_token_encrypted, line_user_id')
    .eq('id', 'default')
    .maybeSingle();

  if (body?.action === 'invite') {
    if (!settings?.oa_basic_id) {
      return NextResponse.json(
        { message: 'กรุณาบันทึก LINE OA Basic ID ก่อนสร้างรหัสผูก LINE' },
        { status: 400 }
      );
    }
    const code = randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabaseAdmin.from('marketplace_line_link_tokens').delete().eq('created_by', caller.sub);
    const { error } = await supabaseAdmin.from('marketplace_line_link_tokens').insert({
      token_hash: createHash('sha256').update(code).digest('hex'),
      expires_at: expiresAt,
      created_by: caller.sub,
    });
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    const command = `MARKETPLACE ${code}`;
    const lineUrl = `https://line.me/R/oaMessage/${encodeURIComponent(
      settings.oa_basic_id
    )}/?${encodeURIComponent(command)}`;
    return NextResponse.json({ invitation: { code, expiresAt, lineUrl } });
  }

  if (body?.action !== 'test' && body?.action !== 'test_event') {
    return NextResponse.json({ message: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
  }
  if (!settings?.channel_access_token_encrypted || !settings.line_user_id) {
    return NextResponse.json(
      { message: 'กรุณาบันทึก Access token และผูก LINE ก่อน' },
      { status: 400 }
    );
  }

  const testEvent = String(body?.event ?? '') as TestNotificationEvent;
  if (
    body.action === 'test_event' &&
    !Object.prototype.hasOwnProperty.call(TEST_NOTIFICATION_MESSAGES, testEvent)
  ) {
    return NextResponse.json({ message: 'ประเภทรายการแจ้งเตือนไม่ถูกต้อง' }, { status: 400 });
  }

  const messageText =
    body.action === 'test_event'
      ? `${TEST_NOTIFICATION_MESSAGES[testEvent]}\n\nเปิดหน้าที่เกี่ยวข้อง: ${
          testEvent === 'new_seller'
            ? `${new URL(request.url).origin}/dashboard/seller-approvals`
            : testEvent === 'product_approval'
              ? `${new URL(request.url).origin}/dashboard/product-approvals`
              : `${new URL(request.url).origin}/dashboard/payouts`
        }`
      : '✅ ทดสอบแจ้งเตือน E-KRU Marketplace สำเร็จ';

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
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(
        { message: result?.message ?? 'LINE ปฏิเสธการส่งข้อความ' },
        { status: 400 }
      );
    }
    return NextResponse.json({
      success: true,
      ...(body.action === 'test_event' && { event: testEvent }),
    });
  } catch {
    return NextResponse.json({ message: 'ไม่สามารถเชื่อมต่อ LINE ได้' }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = authorize(request);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตั้งค่า LINE Marketplace' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('marketplace_line_settings')
    .update({
      line_user_id: null,
      line_display_name: null,
      line_linked_at: null,
      is_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default');
  await supabaseAdmin.from('marketplace_line_link_tokens').delete().eq('created_by', caller.sub);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
