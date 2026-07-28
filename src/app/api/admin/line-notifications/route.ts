import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { schoolHasFeature } from 'src/lib/school-subscription';
import { encryptLineCredential, decryptLineCredential } from 'src/lib/line-credentials';

// ----------------------------------------------------------------------

async function authorize(request: Request) {
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) return null;
  return (await schoolHasFeature(caller.schoolId, 'admin.line_notifications')) ? caller : null;
}

function withTrailingSlash(url: string) {
  return `${url.replace(/\/+$/, '')}/`;
}

export async function GET(request: Request) {
  const caller = await authorize(request);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'แพ็กเกจนี้ไม่รองรับการแจ้งเตือน LINE' }, { status: 403 });
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    { data: integration },
    { data: subscription },
    { count: sentCount },
    { count: pendingCount },
    { count: failedCount },
    { count: skippedCount },
    { count: linkedGuardians },
    { data: recentDeliveries },
  ] = await Promise.all([
    supabaseAdmin
      .from('school_line_integrations')
      .select(
        'channel_id, channel_secret_encrypted, channel_access_token_encrypted, oa_basic_id, webhook_url, is_enabled, notify_absent, notify_leave, notify_late, notify_class_absent, updated_at'
      )
      .eq('school_id', caller.schoolId)
      .maybeSingle(),
    supabaseAdmin
      .from('school_subscriptions')
      .select('max_line_notifications')
      .eq('school_id', caller.schoolId)
      .maybeSingle(),
    supabaseAdmin
      .from('line_notification_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', caller.schoolId)
      .eq('status', 'sent')
      .gte('sent_at', monthStart.toISOString()),
    supabaseAdmin
      .from('line_notification_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', caller.schoolId)
      .in('status', ['pending', 'processing'])
      .gte('created_at', monthStart.toISOString()),
    supabaseAdmin
      .from('line_notification_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', caller.schoolId)
      .eq('status', 'failed')
      .gte('created_at', monthStart.toISOString()),
    supabaseAdmin
      .from('line_notification_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', caller.schoolId)
      .eq('status', 'skipped')
      .gte('created_at', monthStart.toISOString()),
    supabaseAdmin
      .from('student_guardians')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', caller.schoolId)
      .not('line_user_id', 'is', null),
    supabaseAdmin
      .from('line_notification_deliveries')
      .select(
        `id, event_type, status, last_error, sent_at, created_at,
         guardian:student_guardians(full_name),
         student:app_users(name_prefix, first_name, last_name, username)`
      )
      .eq('school_id', caller.schoolId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({
    integration: {
      channelId: integration?.channel_id ?? '',
      oaBasicId: integration?.oa_basic_id ?? '',
      isEnabled: integration?.is_enabled ?? false,
      hasChannelSecret: Boolean(integration?.channel_secret_encrypted),
      hasAccessToken: Boolean(integration?.channel_access_token_encrypted),
      notifyAbsent: integration?.notify_absent ?? true,
      notifyLeave: integration?.notify_leave ?? true,
      notifyLate: integration?.notify_late ?? true,
      notifyClassAbsent: integration?.notify_class_absent ?? true,
      updatedAt: integration?.updated_at ?? null,
    },
    usage: {
      sent: sentCount ?? 0,
      pending: pendingCount ?? 0,
      failed: failedCount ?? 0,
      skipped: skippedCount ?? 0,
      limit: subscription?.max_line_notifications ?? 0,
      linkedGuardians: linkedGuardians ?? 0,
    },
    webhookUrl: withTrailingSlash(
      integration?.webhook_url ??
        `${new URL(request.url).origin}/api/line/webhook/${caller.schoolId}`
    ),
    recentDeliveries: recentDeliveries ?? [],
  });
}

export async function PATCH(request: Request) {
  const caller = await authorize(request);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'แพ็กเกจนี้ไม่รองรับการแจ้งเตือน LINE' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const channelId = typeof body?.channelId === 'string' ? body.channelId.trim() : '';
  const rawOaBasicId = typeof body?.oaBasicId === 'string' ? body.oaBasicId.trim() : '';
  const oaBasicId = rawOaBasicId ? `@${rawOaBasicId.replace(/^@+/, '')}` : '';
  const webhookUrl = typeof body?.webhookUrl === 'string' ? body.webhookUrl.trim() : '';
  const channelSecret = typeof body?.channelSecret === 'string' ? body.channelSecret.trim() : '';
  const accessToken = typeof body?.accessToken === 'string' ? body.accessToken.trim() : '';
  const isEnabled = body?.isEnabled === true;

  let parsedWebhookUrl: URL | null = null;
  try {
    parsedWebhookUrl = webhookUrl ? new URL(webhookUrl) : null;
  } catch {
    parsedWebhookUrl = null;
  }
  const expectedWebhookPath = `/api/line/webhook/${caller.schoolId}`;

  if (
    !channelId ||
    channelId.length > 100 ||
    oaBasicId.length > 100 ||
    channelSecret.length > 500 ||
    accessToken.length > 2000 ||
    !parsedWebhookUrl ||
    parsedWebhookUrl.protocol !== 'https:' ||
    parsedWebhookUrl.pathname.replace(/\/+$/, '') !== expectedWebhookPath ||
    Boolean(parsedWebhookUrl.search || parsedWebhookUrl.hash) ||
    ['notifyAbsent', 'notifyLeave', 'notifyLate', 'notifyClassAbsent'].some(
      (key) => typeof body?.[key] !== 'boolean'
    )
  ) {
    return NextResponse.json({ message: 'ข้อมูลการเชื่อมต่อ LINE ไม่ถูกต้อง' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('school_line_integrations')
    .select('channel_secret_encrypted, channel_access_token_encrypted')
    .eq('school_id', caller.schoolId)
    .maybeSingle();
  if (
    isEnabled &&
    (!(channelSecret || existing?.channel_secret_encrypted) ||
      !(accessToken || existing?.channel_access_token_encrypted))
  ) {
    return NextResponse.json(
      { message: 'กรุณากรอก Channel secret และ Channel access token ก่อนเปิดใช้งาน' },
      { status: 400 }
    );
  }

  const payload = {
    school_id: caller.schoolId,
    channel_id: channelId,
    oa_basic_id: oaBasicId || null,
    webhook_url: `${parsedWebhookUrl.origin}${expectedWebhookPath}/`,
    is_enabled: isEnabled,
    notify_absent: body.notifyAbsent,
    notify_leave: body.notifyLeave,
    notify_late: body.notifyLate,
    notify_class_absent: body.notifyClassAbsent,
    ...(channelSecret && { channel_secret_encrypted: encryptLineCredential(channelSecret) }),
    ...(accessToken && { channel_access_token_encrypted: encryptLineCredential(accessToken) }),
  };
  const { error } = await supabaseAdmin
    .from('school_line_integrations')
    .upsert(payload, { onConflict: 'school_id' });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  const caller = await authorize(request);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'แพ็กเกจนี้ไม่รองรับการแจ้งเตือน LINE' }, { status: 403 });
  }
  const { data: integration } = await supabaseAdmin
    .from('school_line_integrations')
    .select('channel_access_token_encrypted')
    .eq('school_id', caller.schoolId)
    .maybeSingle();
  if (!integration?.channel_access_token_encrypted) {
    return NextResponse.json({ message: 'ยังไม่ได้บันทึก Channel access token' }, { status: 400 });
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/info', {
      headers: {
        Authorization: `Bearer ${decryptLineCredential(
          integration.channel_access_token_encrypted
        )}`,
      },
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(
        { message: result?.message ?? 'LINE ปฏิเสธข้อมูลเชื่อมต่อ' },
        { status: 400 }
      );
    }
    return NextResponse.json({ bot: result });
  } catch {
    return NextResponse.json({ message: 'ไม่สามารถเชื่อมต่อ LINE ได้' }, { status: 502 });
  }
}
