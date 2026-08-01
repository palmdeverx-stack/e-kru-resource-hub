import { after, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import { encryptLineCredential, decryptLineCredential } from 'src/lib/line-credentials';

import { provisionEkruSystemSeller } from 'src/sections/marketplace/seller/server/system-seller';
import {
  getSellerLineFeatureAccess,
  type SellerLineFeatureAccess,
} from 'src/sections/marketplace/seller/server/seller-line-access';
import {
  pushSellerLineText,
  retryFailedSellerPaymentNotifications,
} from 'src/sections/marketplace/seller/server/seller-line-notifications';

const LINE_USER_ID_PATTERN = /^U[0-9a-f]{32}$/i;

type Caller = NonNullable<ReturnType<typeof requireAuthenticated>>;

async function loadLineQuota(encryptedAccessToken: string) {
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
    return {
      used: Math.max(0, Number(consumption.totalUsage) || 0),
      limit:
        quota.type === 'limited' ? Math.max(0, Number(quota.value) || 0) : (null as number | null),
      error: null,
    };
  } catch (error) {
    return {
      used: null,
      limit: null,
      error: error instanceof Error ? error.message : 'โหลดโควตา LINE ไม่สำเร็จ',
    };
  }
}

async function findSeller(caller: Caller) {
  const { data: seller, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, display_name, status')
    .eq('owner_id', caller.sub)
    .maybeSingle();
  if (error) throw error;
  if (seller || (caller.role !== 'master_admin' && caller.role !== 'marketplace_admin'))
    return seller;

  const result = await provisionEkruSystemSeller(caller.sub);
  if (result.error) throw result.error;
  return result.data;
}

function sellerLineAccessError(access: SellerLineFeatureAccess) {
  if (!access.allowed) {
    return NextResponse.json(
      { message: 'Super Admin ยังไม่อนุญาตให้ใช้ LINE แจ้งเตือนร้านค้า' },
      { status: 403 }
    );
  }
  if (!access.entitled) {
    return NextResponse.json(
      {
        message: 'กรุณาซื้อฟีเจอร์ LINE แจ้งเตือนยอดขายก่อนใช้งาน',
        purchaseProductId: access.purchaseProductId,
      },
      { status: 402 }
    );
  }
  return null;
}

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const url = new URL(request.url);
  const deliveryPage = Math.max(
    1,
    Number.parseInt(url.searchParams.get('deliveryPage') ?? '1', 10) || 1
  );
  const deliveryLimit = Math.min(
    20,
    Math.max(1, Number.parseInt(url.searchParams.get('deliveryLimit') ?? '5', 10) || 5)
  );
  const deliveryOffset = (deliveryPage - 1) * deliveryLimit;

  try {
    const access = await getSellerLineFeatureAccess(caller.sub, caller.role);
    if (url.searchParams.get('access') === '1') {
      return NextResponse.json(access);
    }
    const accessError = sellerLineAccessError(access);
    if (accessError) return accessError;
    const seller = await findSeller(caller);
    if (!seller) return NextResponse.json({ message: 'กรุณาสมัครเปิดร้านก่อน' }, { status: 404 });

    const [
      { data: settings, error: settingsError },
      { data: deliveries, error: deliveriesError, count: deliveryCount },
      { data: globalLineSettings, error: globalSettingsError },
    ] = await Promise.all([
      supabaseAdmin
        .from('marketplace_seller_line_settings')
        .select(
          'line_user_id, line_display_name, line_linked_at, is_enabled, notify_payment_received, channel_access_token_encrypted, updated_at'
        )
        .eq('seller_id', seller.id)
        .maybeSingle(),
      supabaseAdmin
        .from('marketplace_seller_line_deliveries')
        .select('id, event_type, amount, status, last_error, created_at, sent_at', {
          count: 'exact',
        })
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false })
        .range(deliveryOffset, deliveryOffset + deliveryLimit - 1),
      supabaseAdmin
        .from('marketplace_line_settings')
        .select('oa_basic_id, channel_access_token_encrypted')
        .eq('id', 'default')
        .maybeSingle(),
    ]);
    if (settingsError || deliveriesError || globalSettingsError) {
      throw settingsError ?? deliveriesError ?? globalSettingsError;
    }
    const lineQuota =
      access.mode === 'byoa' && settings?.channel_access_token_encrypted
        ? await loadLineQuota(settings.channel_access_token_encrypted)
        : null;
    const usage = access.usage
      ? {
          ...access.usage,
          ...(lineQuota?.used !== null &&
            lineQuota?.used !== undefined && {
              quotaUsed: lineQuota.used,
              quotaTotal: lineQuota.limit,
            }),
          quotaSource: lineQuota ? ('line' as const) : ('package' as const),
          quotaError: lineQuota?.error ?? null,
        }
      : null;

    return NextResponse.json({
      seller,
      mode: access.mode,
      usage,
      settings: {
        lineUserId: access.mode === 'managed' ? '' : (settings?.line_user_id ?? ''),
        isEnabled: settings?.is_enabled ?? false,
        notifyPaymentReceived: settings?.notify_payment_received ?? true,
        hasAccessToken: Boolean(settings?.channel_access_token_encrypted),
        updatedAt: settings?.updated_at ?? null,
      },
      lineConnection: {
        displayName: settings?.line_display_name ?? null,
        linkedAt: settings?.line_linked_at ?? null,
        systemAvailable: Boolean(
          globalLineSettings?.oa_basic_id && globalLineSettings.channel_access_token_encrypted
        ),
      },
      recentDeliveries: deliveries ?? [],
      deliveryPagination: {
        page: deliveryPage,
        limit: deliveryLimit,
        total: deliveryCount ?? 0,
        totalPages: Math.ceil((deliveryCount ?? 0) / deliveryLimit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'โหลดการตั้งค่าไม่สำเร็จ' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const body = await request.json().catch(() => null);

  try {
    const access = await getSellerLineFeatureAccess(caller.sub, caller.role);
    const accessError = sellerLineAccessError(access);
    if (accessError) return accessError;
    const seller = await findSeller(caller);
    if (!seller) return NextResponse.json({ message: 'กรุณาสมัครเปิดร้านก่อน' }, { status: 404 });

    const lineUserId = String(body?.lineUserId ?? '').trim();
    const accessToken = String(body?.accessToken ?? '').trim();
    const isEnabled = body?.isEnabled === true;
    const usesManagedLine = access.mode === 'managed';
    if (
      (!usesManagedLine && lineUserId && !LINE_USER_ID_PATTERN.test(lineUserId)) ||
      accessToken.length > 2000 ||
      typeof body?.notifyPaymentReceived !== 'boolean'
    ) {
      return NextResponse.json(
        { message: 'LINE User ID หรือข้อมูลการแจ้งเตือนไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from('marketplace_seller_line_settings')
      .select('channel_access_token_encrypted, line_user_id')
      .eq('seller_id', seller.id)
      .maybeSingle();

    const requiresOwnToken = access.mode === 'byoa';
    if (isEnabled && usesManagedLine && !existing?.line_user_id) {
      return NextResponse.json(
        { message: 'กรุณาผูกบัญชี LINE ผ่าน QR ก่อนเปิดใช้งาน' },
        { status: 400 }
      );
    }
    if (
      isEnabled &&
      requiresOwnToken &&
      (!lineUserId || !(accessToken || existing?.channel_access_token_encrypted))
    ) {
      return NextResponse.json(
        { message: 'กรุณากรอก Channel access token และ LINE User ID ก่อนเปิดใช้งาน' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from('marketplace_seller_line_settings').upsert(
      {
        seller_id: seller.id,
        ...(!usesManagedLine && { line_user_id: lineUserId || null }),
        is_enabled: isEnabled,
        notify_payment_received: body.notifyPaymentReceived,
        ...(!usesManagedLine &&
          accessToken && {
            channel_access_token_encrypted: encryptLineCredential(accessToken),
          }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'seller_id' }
    );
    if (error) throw error;
    if (isEnabled && body.notifyPaymentReceived) {
      after(() =>
        retryFailedSellerPaymentNotifications(seller.id).catch((retryError) => {
          console.error('Unable to retry seller LINE notifications after enabling', retryError);
        })
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'บันทึกการตั้งค่าไม่สำเร็จ' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (body?.action === 'invite') {
    try {
      const access = await getSellerLineFeatureAccess(caller.sub, caller.role);
      const accessError = sellerLineAccessError(access);
      if (accessError) return accessError;
      if (access.mode !== 'managed') {
        return NextResponse.json(
          { message: 'การผูก LINE ผ่าน QR ใช้ได้กับแพ็กเกจ LINE ของระบบเท่านั้น' },
          { status: 400 }
        );
      }
      const seller = await findSeller(caller);
      if (!seller) {
        return NextResponse.json({ message: 'กรุณาสมัครเปิดร้านก่อน' }, { status: 404 });
      }
      const { data: globalSettings } = await supabaseAdmin
        .from('marketplace_line_settings')
        .select('oa_basic_id, channel_access_token_encrypted')
        .eq('id', 'default')
        .maybeSingle();
      if (!globalSettings?.oa_basic_id || !globalSettings.channel_access_token_encrypted) {
        return NextResponse.json(
          { message: 'ผู้ดูแลระบบยังตั้งค่า LINE OA ของระบบไม่ครบ' },
          { status: 409 }
        );
      }

      const code = randomBytes(4).toString('hex').toUpperCase();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await supabaseAdmin
        .from('marketplace_seller_line_link_tokens')
        .delete()
        .eq('seller_id', seller.id);
      const { error } = await supabaseAdmin.from('marketplace_seller_line_link_tokens').insert({
        seller_id: seller.id,
        token_hash: createHash('sha256').update(code).digest('hex'),
        expires_at: expiresAt,
        created_by: caller.sub,
      });
      if (error) throw error;

      const command = `SELLER ${code}`;
      const normalizedBasicId = `@${globalSettings.oa_basic_id.replace(/^@+/, '')}`;
      const basicIdWithoutAt = normalizedBasicId.slice(1);
      const addFriendUrl = `https://line.me/R/ti/p/${encodeURIComponent(normalizedBasicId)}`;
      const lineChatUrl = `https://line.me/R/oaMessage/${encodeURIComponent(
        normalizedBasicId
      )}/?${encodeURIComponent(command)}`;
      return NextResponse.json({
        invitation: {
          code,
          expiresAt,
          addFriendUrl,
          lineChatUrl,
          qrCodeUrl: `https://qr-official.line.me/gs/M_${encodeURIComponent(
            basicIdWithoutAt
          )}_GW.png`,
        },
      });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : 'สร้างรหัสผูก LINE ไม่สำเร็จ' },
        { status: 500 }
      );
    }
  }
  if (body?.action !== 'test') {
    return NextResponse.json({ message: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
  }

  if (
    !(await isActionAllowed({
      request,
      action: 'marketplace-line-test',
      subject: caller.sub,
      maxAttempts: 10,
      windowSeconds: 10 * 60,
    }))
  ) {
    return NextResponse.json(
      { message: 'ทดลองส่ง LINE บ่อยเกินไป กรุณารอสักครู่' },
      { status: 429 }
    );
  }

  try {
    const access = await getSellerLineFeatureAccess(caller.sub, caller.role);
    const accessError = sellerLineAccessError(access);
    if (accessError) return accessError;
    const seller = await findSeller(caller);
    if (!seller) return NextResponse.json({ message: 'กรุณาสมัครเปิดร้านก่อน' }, { status: 404 });
    const { data: settings } = await supabaseAdmin
      .from('marketplace_seller_line_settings')
      .select('channel_access_token_encrypted, line_user_id')
      .eq('seller_id', seller.id)
      .maybeSingle();
    const { data: globalSettings } = await supabaseAdmin
      .from('marketplace_line_settings')
      .select('channel_access_token_encrypted')
      .eq('id', 'default')
      .maybeSingle();
    const encryptedAccessToken =
      access.mode === 'managed'
        ? globalSettings?.channel_access_token_encrypted
        : (settings?.channel_access_token_encrypted ??
          globalSettings?.channel_access_token_encrypted);
    if (!encryptedAccessToken || !settings?.line_user_id) {
      return NextResponse.json(
        {
          message:
            access.mode === 'managed'
              ? 'กรุณาผูกบัญชี LINE ผ่าน QR และให้ผู้ดูแลตั้งค่า LINE OA ระบบก่อนทดสอบ'
              : 'กรุณาบันทึก Channel access token และ LINE User ID ก่อนทดสอบ',
        },
        { status: 400 }
      );
    }

    const message = `✅ เชื่อมต่อ LINE สำเร็จ\nร้าน ${seller.display_name}\nE-KRU Marketplace พร้อมแจ้งเตือนเมื่อยืนยันการชำระเงินจากผู้ซื้อ`;
    let status: 'sent' | 'failed' = 'failed';
    let lastError: string | null = null;
    try {
      await pushSellerLineText({
        accessToken: decryptLineCredential(encryptedAccessToken),
        lineUserId: settings.line_user_id,
        message,
      });
      status = 'sent';
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'LINE ปฏิเสธการส่งข้อความ';
    }

    await supabaseAdmin.from('marketplace_seller_line_deliveries').insert({
      seller_id: seller.id,
      event_type: 'test',
      message_text: message,
      status,
      last_error: lastError,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    });

    if (status === 'failed') {
      return NextResponse.json({ message: lastError }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'ทดสอบ LINE ไม่สำเร็จ' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  try {
    const seller = await findSeller(caller);
    if (!seller) return NextResponse.json({ message: 'กรุณาสมัครเปิดร้านก่อน' }, { status: 404 });
    const { error } = await supabaseAdmin
      .from('marketplace_seller_line_settings')
      .update({
        line_user_id: null,
        line_display_name: null,
        line_linked_at: null,
        is_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('seller_id', seller.id);
    if (error) throw error;
    await supabaseAdmin
      .from('marketplace_seller_line_link_tokens')
      .delete()
      .eq('seller_id', seller.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'ยกเลิกการผูก LINE ไม่สำเร็จ' },
      { status: 500 }
    );
  }
}
