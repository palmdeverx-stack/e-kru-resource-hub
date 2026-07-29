import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { encryptLineCredential, decryptLineCredential } from 'src/lib/line-credentials';

import { provisionEkruSystemSeller } from 'src/sections/marketplace/seller/server/system-seller';
import { pushSellerLineText } from 'src/sections/marketplace/seller/server/seller-line-notifications';

const LINE_USER_ID_PATTERN = /^U[0-9a-f]{32}$/i;

type Caller = NonNullable<ReturnType<typeof requireAuthenticated>>;

async function findSeller(caller: Caller) {
  const { data: seller, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, display_name, status')
    .eq('owner_id', caller.sub)
    .maybeSingle();
  if (error) throw error;
  if (seller || caller.role !== 'master_admin') return seller;

  const result = await provisionEkruSystemSeller(caller.sub);
  if (result.error) throw result.error;
  return result.data;
}

async function sellerLineAllowed(caller: Caller) {
  if (caller.role === 'master_admin') return true;
  const { data, error } = await supabaseAdmin
    .from('marketplace_line_settings')
    .select('allow_seller_notifications')
    .eq('id', 'default')
    .maybeSingle();
  if (error) throw error;
  return data?.allow_seller_notifications === true;
}

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  try {
    const allowed = await sellerLineAllowed(caller);
    if (new URL(request.url).searchParams.get('access') === '1') {
      return NextResponse.json({ allowed });
    }
    if (!allowed) {
      return NextResponse.json(
        { message: 'Super Admin ยังไม่อนุญาตให้ใช้ LINE แจ้งเตือนร้านค้า' },
        { status: 403 }
      );
    }
    const seller = await findSeller(caller);
    if (!seller) return NextResponse.json({ message: 'กรุณาสมัครเปิดร้านก่อน' }, { status: 404 });

    const [{ data: settings, error }, { data: deliveries }] = await Promise.all([
      supabaseAdmin
        .from('marketplace_seller_line_settings')
        .select(
          'line_user_id, is_enabled, notify_payment_received, channel_access_token_encrypted, updated_at'
        )
        .eq('seller_id', seller.id)
        .maybeSingle(),
      supabaseAdmin
        .from('marketplace_seller_line_deliveries')
        .select('id, event_type, amount, status, last_error, created_at, sent_at')
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);
    if (error) throw error;

    return NextResponse.json({
      seller,
      settings: {
        lineUserId: settings?.line_user_id ?? '',
        isEnabled: settings?.is_enabled ?? false,
        notifyPaymentReceived: settings?.notify_payment_received ?? true,
        hasAccessToken: Boolean(settings?.channel_access_token_encrypted),
        updatedAt: settings?.updated_at ?? null,
      },
      recentDeliveries: deliveries ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'โหลดการตั้งค่าไม่สำเร็จ' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const body = await request.json().catch(() => null);

  try {
    if (!(await sellerLineAllowed(caller))) {
      return NextResponse.json(
        { message: 'Super Admin ยังไม่อนุญาตให้ใช้ LINE แจ้งเตือนร้านค้า' },
        { status: 403 }
      );
    }
    const seller = await findSeller(caller);
    if (!seller) return NextResponse.json({ message: 'กรุณาสมัครเปิดร้านก่อน' }, { status: 404 });

    const lineUserId = String(body?.lineUserId ?? '').trim();
    const accessToken = String(body?.accessToken ?? '').trim();
    const isEnabled = body?.isEnabled === true;
    if (
      (lineUserId && !LINE_USER_ID_PATTERN.test(lineUserId)) ||
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
      .select('channel_access_token_encrypted')
      .eq('seller_id', seller.id)
      .maybeSingle();

    if (
      isEnabled &&
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
        line_user_id: lineUserId || null,
        is_enabled: isEnabled,
        notify_payment_received: body.notifyPaymentReceived,
        ...(accessToken && {
          channel_access_token_encrypted: encryptLineCredential(accessToken),
        }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'seller_id' }
    );
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'บันทึกการตั้งค่าไม่สำเร็จ' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (body?.action !== 'test') {
    return NextResponse.json({ message: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
  }

  try {
    if (!(await sellerLineAllowed(caller))) {
      return NextResponse.json(
        { message: 'Super Admin ยังไม่อนุญาตให้ใช้ LINE แจ้งเตือนร้านค้า' },
        { status: 403 }
      );
    }
    const seller = await findSeller(caller);
    if (!seller) return NextResponse.json({ message: 'กรุณาสมัครเปิดร้านก่อน' }, { status: 404 });
    const { data: settings } = await supabaseAdmin
      .from('marketplace_seller_line_settings')
      .select('channel_access_token_encrypted, line_user_id')
      .eq('seller_id', seller.id)
      .maybeSingle();
    if (!settings?.channel_access_token_encrypted || !settings.line_user_id) {
      return NextResponse.json(
        { message: 'กรุณาบันทึก Channel access token และ LINE User ID ก่อนทดสอบ' },
        { status: 400 }
      );
    }

    const message = `✅ เชื่อมต่อ LINE สำเร็จ\nร้าน ${seller.display_name}\nE-KRU Marketplace พร้อมแจ้งเตือนเมื่อยืนยันการชำระเงินจากผู้ซื้อ`;
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
