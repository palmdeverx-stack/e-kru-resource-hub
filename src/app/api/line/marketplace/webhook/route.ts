import { NextResponse } from 'next/server';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { decryptLineCredential } from 'src/lib/line-credentials';

function validSignature(body: string, signature: string, secret: string) {
  const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('base64'));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function reply(accessToken: string, replyToken: string, text: string) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-line-signature') ?? '';
  const { data: settings } = await supabaseAdmin
    .from('marketplace_line_settings')
    .select('channel_secret_encrypted, channel_access_token_encrypted')
    .eq('id', 'default')
    .maybeSingle();

  if (!settings?.channel_secret_encrypted) {
    return NextResponse.json({ message: 'LINE integration is unavailable' }, { status: 404 });
  }

  let channelSecret: string;
  try {
    channelSecret = decryptLineCredential(settings.channel_secret_encrypted);
  } catch {
    return NextResponse.json({ message: 'Invalid LINE credentials' }, { status: 500 });
  }
  if (!signature || !validSignature(rawBody, signature, channelSecret)) {
    return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as {
    events?: Array<{
      type: string;
      replyToken?: string;
      source?: { userId?: string };
      message?: { type?: string; text?: string };
    }>;
  };
  if (!payload.events?.length) return NextResponse.json({ success: true });
  if (!settings.channel_access_token_encrypted) {
    return NextResponse.json({ success: true, ignored: true });
  }

  const accessToken = decryptLineCredential(settings.channel_access_token_encrypted);
  for (const event of payload.events) {
    if (
      event.type !== 'message' ||
      event.message?.type !== 'text' ||
      !event.message.text ||
      !event.source?.userId ||
      !event.replyToken
    ) {
      continue;
    }

    const sellerMatch = /^SELLER\s+([A-F0-9]{8})$/i.exec(event.message.text.trim());
    const adminMatch = /^MARKETPLACE\s+([A-F0-9]{8})$/i.exec(event.message.text.trim());
    if (!sellerMatch && !adminMatch) continue;

    if (sellerMatch) {
      const tokenHash = createHash('sha256').update(sellerMatch[1].toUpperCase()).digest('hex');
      const { data: token } = await supabaseAdmin
        .from('marketplace_seller_line_link_tokens')
        .select('id, seller_id, expires_at, used_at')
        .eq('token_hash', tokenHash)
        .maybeSingle();
      if (!token || token.used_at || token.expires_at < new Date().toISOString()) {
        await reply(accessToken, event.replyToken, 'รหัสผูก LINE ไม่ถูกต้องหรือหมดอายุแล้ว');
        continue;
      }

      let displayName: string | null = null;
      const profileResponse = await fetch(
        `https://api.line.me/v2/bot/profile/${encodeURIComponent(event.source.userId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (profileResponse.ok) {
        const profile = (await profileResponse.json()) as { displayName?: string };
        displayName = profile.displayName ?? null;
      }

      await supabaseAdmin.from('marketplace_seller_line_settings').upsert(
        {
          seller_id: token.seller_id,
          line_user_id: event.source.userId,
          line_display_name: displayName,
          line_linked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'seller_id' }
      );
      await supabaseAdmin
        .from('marketplace_seller_line_link_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', token.id);
      await reply(
        accessToken,
        event.replyToken,
        '✅ ผูก LINE กับร้านค้าของคุณสำเร็จ\nคุณจะได้รับแจ้งเตือนเมื่อระบบยืนยันยอดขาย'
      );
      continue;
    }

    const tokenHash = createHash('sha256').update(adminMatch![1].toUpperCase()).digest('hex');
    const { data: token } = await supabaseAdmin
      .from('marketplace_line_link_tokens')
      .select('id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (!token || token.used_at || token.expires_at < new Date().toISOString()) {
      await reply(accessToken, event.replyToken, 'รหัสผูก LINE ไม่ถูกต้องหรือหมดอายุแล้ว');
      continue;
    }

    let displayName: string | null = null;
    const profileResponse = await fetch(
      `https://api.line.me/v2/bot/profile/${encodeURIComponent(event.source.userId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (profileResponse.ok) {
      const profile = (await profileResponse.json()) as { displayName?: string };
      displayName = profile.displayName ?? null;
    }

    await supabaseAdmin
      .from('marketplace_line_settings')
      .update({
        line_user_id: event.source.userId,
        line_display_name: displayName,
        line_linked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'default');
    await supabaseAdmin
      .from('marketplace_line_link_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', token.id);
    await reply(
      accessToken,
      event.replyToken,
      '✅ ผูก LINE กับ E-KRU Marketplace สำเร็จ\nคุณจะได้รับแจ้งเตือนเมื่อมีผู้ขายหรือสินค้ารอตรวจสอบ'
    );
  }

  return NextResponse.json({ success: true });
}
