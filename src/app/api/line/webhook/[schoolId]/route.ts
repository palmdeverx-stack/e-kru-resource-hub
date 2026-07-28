import { NextResponse } from 'next/server';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { decryptLineCredential } from 'src/lib/line-credentials';
import { signGuardianPortalIdentityToken } from 'src/lib/guardian-portal-token';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ schoolId: string }> };

type LineMessage =
  | { type: 'text'; text: string }
  | {
      type: 'flex';
      altText: string;
      contents: Record<string, unknown>;
    };

function validSignature(body: string, signature: string, secret: string) {
  const expected = createHmac('sha256', secret).update(body).digest('base64');
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

async function sendMessages(
  accessToken: string,
  replyToken: string,
  lineUserId: string,
  messages: LineMessage[]
) {
  try {
    const replyResponse = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ replyToken, messages }),
    });
    if (replyResponse.ok) return true;

    console.error('LINE reply failed; falling back to push', {
      status: replyResponse.status,
      body: await replyResponse.text(),
    });
    const pushResponse = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ to: lineUserId, messages }),
    });
    if (!pushResponse.ok) {
      console.error('LINE push fallback failed', {
        status: pushResponse.status,
        body: await pushResponse.text(),
      });
    }
    return pushResponse.ok;
  } catch (error) {
    console.error('Unable to send LINE bot response', error);
    return false;
  }
}

function sendText(accessToken: string, replyToken: string, lineUserId: string, text: string) {
  return sendMessages(accessToken, replyToken, lineUserId, [{ type: 'text', text }]);
}

function guardianPortalMessage(url: string): LineMessage {
  return {
    type: 'flex',
    altText: 'เปิดข้อมูลนักเรียน',
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: 'ข้อมูลนักเรียน',
            weight: 'bold',
            size: 'xl',
            color: '#172B4D',
          },
          {
            type: 'text',
            text: 'ดูโปรไฟล์และประวัติการเข้าเรียนของบุตรหลาน',
            size: 'sm',
            color: '#6B7A90',
            wrap: true,
          },
          {
            type: 'text',
            text: 'กรุณากรอกรหัสนักเรียนที่เชื่อมกับ LINE นี้',
            size: 'xs',
            color: '#8A94A6',
            wrap: true,
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#1976D2',
            action: {
              type: 'uri',
              label: 'เปิดข้อมูลนักเรียน',
              uri: url,
            },
          },
        ],
      },
    },
  };
}

function normalizeCommand(value: string) {
  const text = value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (!text.includes('=')) return text;
  const params = new URLSearchParams(text);
  return params.get('command') ?? params.get('action') ?? params.get('data') ?? text;
}

function guardianPortalUrl(request: Request, schoolId: string, lineUserId: string) {
  const token = signGuardianPortalIdentityToken(schoolId, lineUserId);
  const url = new URL('/api/guardian/portal/session/', request.url);
  url.searchParams.set('token', token);
  return url.toString();
}

export async function POST(request: Request, { params }: RouteParams) {
  const { schoolId } = await params;
  const rawBody = await request.text();
  const signature = request.headers.get('x-line-signature') ?? '';
  const { data: integration } = await supabaseAdmin
    .from('school_line_integrations')
    .select('channel_secret_encrypted, channel_access_token_encrypted')
    .eq('school_id', schoolId)
    .maybeSingle();

  if (!integration?.channel_secret_encrypted) {
    return NextResponse.json({ message: 'LINE integration is unavailable' }, { status: 404 });
  }

  let channelSecret: string;
  try {
    channelSecret = decryptLineCredential(integration.channel_secret_encrypted);
  } catch {
    return NextResponse.json({ message: 'Invalid LINE credentials' }, { status: 500 });
  }
  if (!signature || !validSignature(rawBody, signature, channelSecret)) {
    return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
  }

  let payload: {
    events?: Array<{
      type: string;
      replyToken?: string;
      source?: { type?: string; userId?: string };
      message?: { type?: string; text?: string };
      postback?: { data?: string };
    }>;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: 'Invalid JSON payload' }, { status: 400 });
  }

  // LINE verifies a webhook with a signed request containing no events.
  // It must receive 200 even before the school enables real notifications.
  if (!payload.events?.length) {
    return NextResponse.json({ success: true });
  }
  if (!integration.channel_access_token_encrypted) {
    return NextResponse.json({ success: true, ignored: true });
  }

  let accessToken: string;
  try {
    accessToken = decryptLineCredential(integration.channel_access_token_encrypted);
  } catch {
    return NextResponse.json({ message: 'Invalid LINE access token' }, { status: 500 });
  }

  for (const event of payload.events) {
    if (!event.source?.userId || !event.replyToken) continue;
    const rawCommand =
      event.type === 'message' && event.message?.type === 'text'
        ? event.message.text
        : event.type === 'postback'
          ? event.postback?.data
          : null;
    if (!rawCommand) continue;

    const messageText = normalizeCommand(rawCommand);
    const respond = (text: string) =>
      sendText(accessToken, event.replyToken!, event.source!.userId!, text);
    const respondWithPortal = (text: string) =>
      sendMessages(accessToken, event.replyToken!, event.source!.userId!, [
        { type: 'text', text },
        guardianPortalMessage(guardianPortalUrl(request, schoolId, event.source!.userId!)),
      ]);
    if (
      /^(?:PROFILE|โปรไฟล์|ดู\s*โปรไฟล์|ข้อมูลนักเรียน|ดู\s*ข้อมูลนักเรียน|รายละเอียดนักเรียน|ดู\s*รายละเอียดนักเรียน|ATTENDANCE|การเข้าเรียน|ดู\s*การเข้าเรียน)$/i.test(
        messageText
      )
    ) {
      const { count } = await supabaseAdmin
        .from('student_guardians')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('line_user_id', event.source.userId);
      if (!count) {
        await respond('บัญชี LINE นี้ยังไม่ได้เชื่อมกับนักเรียน กรุณาสแกน QR จากโรงเรียนก่อน');
        continue;
      }
      await respondWithPortal(
        '👨‍👩‍👧 เปิดดูข้อมูลนักเรียนได้จากปุ่มด้านล่าง\nลิงก์ใช้งานได้จนกว่าจะยกเลิกการเชื่อม LINE'
      );
      continue;
    }
    if (/^(?:HELP|ช่วยเหลือ)$/i.test(messageText)) {
      await respond(
        [
          'เมนูช่วยเหลือผู้ปกครอง',
          '• พิมพ์ “ข้อมูลนักเรียน” เพื่อเปิด Parent Portal',
          '• พิมพ์ “การเข้าเรียน” เพื่อดูประวัติการเข้าเรียน',
          '• หากต้องการเชื่อมบัญชี กรุณาสแกน QR ที่ได้รับจากโรงเรียน',
        ].join('\n')
      );
      continue;
    }
    if (/^(?:ประกาศ|ANNOUNCEMENT)$/i.test(messageText)) {
      await respond('ประกาศสำคัญจากโรงเรียนจะถูกส่งมายังห้องแชตนี้โดยตรง');
      continue;
    }
    if (/^(?:ติดต่อโรงเรียน|CONTACT|เชื่อมบัญชี)$/i.test(messageText)) {
      await respond(
        'กรุณาติดต่อครูประจำชั้นหรือผู้ดูแลโรงเรียน หากต้องการความช่วยเหลือหรือขอ QR เชื่อมบัญชี'
      );
      continue;
    }

    const teacherMatch = /^(?:TEACHER|ครู)\s+([A-Z0-9]{8})$/i.exec(messageText);
    if (teacherMatch) {
      const teacherTokenHash = createHash('sha256')
        .update(teacherMatch[1].toUpperCase())
        .digest('hex');
      const { data: teacherLink } = await supabaseAdmin
        .from('teacher_line_link_tokens')
        .select('id, teacher_id, expires_at, used_at')
        .eq('school_id', schoolId)
        .eq('token_hash', teacherTokenHash)
        .maybeSingle();
      if (!teacherLink || teacherLink.used_at || teacherLink.expires_at < new Date().toISOString()) {
        await respond('รหัสเชื่อมบัญชีไม่ถูกต้องหรือหมดอายุแล้ว');
        continue;
      }

      let teacherDisplayName: string | null = null;
      const teacherProfileResponse = await fetch(
        `https://api.line.me/v2/bot/profile/${event.source.userId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (teacherProfileResponse.ok) {
        const profile = (await teacherProfileResponse.json()) as { displayName?: string };
        teacherDisplayName = profile.displayName ?? null;
      }

      const { error: teacherLinkError } = await supabaseAdmin
        .from('app_users')
        .update({
          line_user_id: event.source.userId,
          line_display_name: teacherDisplayName,
          line_linked_at: new Date().toISOString(),
          line_notifications_enabled: true,
        })
        .eq('id', teacherLink.teacher_id)
        .eq('school_id', schoolId);
      if (teacherLinkError) {
        await respond('เชื่อมบัญชีไม่สำเร็จ กรุณาติดต่อผู้ดูแลโรงเรียน');
        continue;
      }
      await supabaseAdmin
        .from('teacher_line_link_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', teacherLink.id);
      await respond(
        [
          'เชื่อมบัญชี LINE กับโรงเรียนเรียบร้อยแล้ว',
          'คุณจะได้รับการแจ้งเตือนจากโรงเรียนผ่าน LINE เช่น เตือนกำหนดส่งผลการเรียน',
        ].join('\n')
      );
      continue;
    }

    const match = /^(?:LINK|เชื่อม)\s+([A-Z0-9]{8})$/i.exec(messageText);
    if (!match) continue;

    const tokenHash = createHash('sha256').update(match[1].toUpperCase()).digest('hex');
    const { data: link } = await supabaseAdmin
      .from('guardian_line_link_tokens')
      .select('id, guardian_id, expires_at, used_at')
      .eq('school_id', schoolId)
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (!link || link.used_at || link.expires_at < new Date().toISOString()) {
      await respond('รหัสเชื่อมบัญชีไม่ถูกต้องหรือหมดอายุแล้ว');
      continue;
    }

    let displayName: string | null = null;
    const profileResponse = await fetch(
      `https://api.line.me/v2/bot/profile/${event.source.userId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (profileResponse.ok) {
      const profile = (await profileResponse.json()) as { displayName?: string };
      displayName = profile.displayName ?? null;
    }

    const { error } = await supabaseAdmin
      .from('student_guardians')
      .update({
        line_user_id: event.source.userId,
        line_display_name: displayName,
        line_linked_at: new Date().toISOString(),
        line_notifications_enabled: true,
      })
      .eq('id', link.guardian_id)
      .eq('school_id', schoolId);
    if (error) {
      await respond('เชื่อมบัญชีไม่สำเร็จ กรุณาติดต่อโรงเรียน');
      continue;
    }
    await supabaseAdmin
      .from('guardian_line_link_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', link.id);
    await respondWithPortal(
      ['เชื่อมบัญชีกับโรงเรียนเรียบร้อยแล้ว', 'คุณจะได้รับการแจ้งเตือนจากโรงเรียนผ่าน LINE'].join(
        '\n'
      )
    );
  }

  return NextResponse.json({ success: true });
}
