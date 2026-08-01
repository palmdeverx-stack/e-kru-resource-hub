import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import { optimizeUploadedImage } from 'src/lib/server-image-optimizer';

type Context = { params: Promise<{ id: string }> };

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  if (
    !(await isActionAllowed({
      request,
      action: 'marketplace-slip-upload',
      subject: caller.sub,
      maxAttempts: 10,
      windowSeconds: 10 * 60,
    }))
  ) {
    return NextResponse.json({ message: 'อัปโหลดสลิปบ่อยเกินไป' }, { status: 429 });
  }

  const { id } = await params;
  const { data: session, error: sessionError } = await supabaseAdmin
    .from('marketplace_payment_sessions')
    .select('*')
    .eq('id', id)
    .eq('buyer_id', caller.sub)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json(
      { message: sessionError?.message ?? 'ไม่พบรายการชำระเงิน' },
      { status: sessionError ? 500 : 404 }
    );
  }
  if (!['pending_payment', 'rejected'].includes(session.status)) {
    return NextResponse.json({ message: 'รายการนี้ไม่สามารถแนบสลิปได้' }, { status: 409 });
  }
  if (session.payment_method !== 'promptpay') {
    return NextResponse.json(
      { message: 'รายการชำระเงินออนไลน์จะยืนยันผลผ่านระบบอัตโนมัติ ไม่ต้องแนบสลิป' },
      { status: 409 }
    );
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await supabaseAdmin
      .from('marketplace_payment_sessions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', id);
    return NextResponse.json({ message: 'รายการชำระเงินหมดอายุแล้ว' }, { status: 410 });
  }

  const formData = await request.formData();
  const slip = formData.get('slip');
  if (!(slip instanceof File) || !ACCEPTED_TYPES.has(slip.type) || slip.size > MAX_SIZE) {
    return NextResponse.json(
      { message: 'กรุณาแนบสลิป JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB' },
      { status: 400 }
    );
  }

  const image = await optimizeUploadedImage(slip, { preset: 'document', output: 'original' });
  const path = `${caller.sub}/${id}/slip-${Date.now()}.${image.extension}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from('marketplace-payment-slips')
    .upload(path, image.data, { contentType: image.contentType, upsert: false });
  if (uploadError) return NextResponse.json({ message: uploadError.message }, { status: 500 });

  const now = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin
    .from('marketplace_payment_sessions')
    .update({
      status: 'payment_review',
      slip_path: path,
      slip_file_name: slip.name.slice(0, 255),
      slip_mime_type: image.contentType,
      submitted_at: now,
      rejection_reason: null,
      updated_at: now,
    })
    .eq('id', id)
    .in('status', ['pending_payment', 'rejected'])
    .select('*')
    .maybeSingle();

  if (error || !updated) {
    await supabaseAdmin.storage.from('marketplace-payment-slips').remove([path]);
    return NextResponse.json(
      { message: error?.message ?? 'สถานะรายการเปลี่ยนไป กรุณาลองใหม่' },
      { status: 409 }
    );
  }

  await supabaseAdmin
    .from('marketplace_orders')
    .update({ status: 'payment_review', updated_at: now })
    .eq('payment_session_id', id)
    .in('status', ['pending_payment', 'payment_rejected']);

  if (session.slip_path && session.slip_path !== path) {
    await supabaseAdmin.storage.from('marketplace-payment-slips').remove([session.slip_path]);
  }

  return NextResponse.json({
    paymentSession: updated,
    message: 'ส่งสลิปให้ผู้ดูแลตรวจสอบแล้ว',
  });
}
