import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';

import {
  verificationExpiry,
  hashVerificationCode,
  createVerificationCode,
  OTP_RESEND_COOLDOWN_SECONDS,
  sendMarketplaceVerificationEmail,
} from 'src/sections/marketplace/auth/server/email-verification';

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email ?? '')
    .trim()
    .toLowerCase();

  if (!email) {
    return NextResponse.json({ message: 'กรุณาระบุอีเมล' }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from('marketplace_users')
    .select('id, email, first_name, is_active, is_suspended')
    .ilike('email', email)
    .maybeSingle();

  if (!user || user.is_active || user.is_suspended) {
    return NextResponse.json({
      success: true,
      message: 'หากอีเมลอยู่ระหว่างการยืนยัน ระบบจะส่งรหัสใหม่ให้',
    });
  }

  const { data: current } = await supabaseAdmin
    .from('marketplace_email_verifications')
    .select('last_sent_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (current?.last_sent_at) {
    const elapsedSeconds = (Date.now() - new Date(current.last_sent_at).getTime()) / 1000;
    if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
      return NextResponse.json(
        {
          message: `กรุณารอ ${Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds)} วินาทีก่อนส่งใหม่`,
        },
        { status: 429 }
      );
    }
  }

  const code = createVerificationCode();
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('marketplace_email_verifications').upsert(
    {
      user_id: user.id,
      email: user.email,
      code_hash: hashVerificationCode(user.id, code),
      expires_at: verificationExpiry(),
      last_sent_at: now,
      attempts: 0,
      verified_at: null,
      updated_at: now,
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  try {
    await sendMarketplaceVerificationEmail({
      to: user.email,
      firstName: user.first_name,
      code,
    });
  } catch (emailError) {
    console.error('Failed to resend marketplace verification email', emailError);
    return NextResponse.json({ message: 'ไม่สามารถส่งอีเมลได้ กรุณาลองใหม่' }, { status: 503 });
  }

  return NextResponse.json({
    success: true,
    message: 'ส่งรหัสใหม่แล้ว กรุณาตรวจสอบอีเมล',
  });
}
