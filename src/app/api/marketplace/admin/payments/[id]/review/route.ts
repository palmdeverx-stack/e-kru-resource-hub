import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { createNotifications } from 'src/lib/notifications';

import { finalizeMarketplacePayment } from 'src/sections/marketplace/checkout/server/finalize-payment';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตรวจสอบการชำระเงิน' }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action;
  const reason = String(body?.reason ?? '').trim();
  const transactionReference = String(body?.transactionReference ?? '').trim();

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ message: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
  }
  if (action === 'reject' && reason.length < 3) {
    return NextResponse.json({ message: 'กรุณาระบุเหตุผลที่ไม่อนุมัติ' }, { status: 400 });
  }
  if (action === 'approve' && transactionReference.length < 4) {
    return NextResponse.json({ message: 'กรุณาระบุเลขอ้างอิงจากสลิป' }, { status: 400 });
  }

  const { data: session, error } = await supabaseAdmin
    .from('marketplace_payment_sessions')
    .select('*, orders:marketplace_orders(*)')
    .eq('id', id)
    .eq('payment_method', 'promptpay')
    .maybeSingle();
  if (error || !session) {
    return NextResponse.json(
      { message: error?.message ?? 'รายการนี้ถูกตรวจสอบไปแล้ว' },
      { status: error ? 500 : 409 }
    );
  }
  if (!['payment_review', 'verified'].includes(session.status)) {
    return NextResponse.json({ message: 'สถานะรายการนี้ไม่สามารถอนุมัติได้' }, { status: 409 });
  }
  if (session.status === 'verified' && action === 'reject') {
    return NextResponse.json({ message: 'รายการที่ยืนยันแล้วไม่สามารถปฏิเสธได้' }, { status: 409 });
  }

  const now = new Date();
  if (action === 'reject') {
    const { error: rejectError } = await supabaseAdmin
      .from('marketplace_payment_sessions')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        reviewed_at: now.toISOString(),
        reviewed_by: caller.sub,
        updated_at: now.toISOString(),
      })
      .eq('id', id)
      .eq('status', 'payment_review');
    if (rejectError) return NextResponse.json({ message: rejectError.message }, { status: 500 });
    await supabaseAdmin
      .from('marketplace_orders')
      .update({ status: 'payment_rejected', updated_at: now.toISOString() })
      .eq('payment_session_id', id);
    await createNotifications([
      {
        userId: session.buyer_id,
        schoolId: null,
        type: 'marketplace_payment_rejected',
        title: 'สลิปชำระเงินไม่ผ่านการตรวจสอบ',
        body: reason,
        link: `/checkout/payment/${id}`,
      },
    ]);
    return NextResponse.json({ success: true });
  }

  const { data: duplicate } = await supabaseAdmin
    .from('marketplace_payment_sessions')
    .select('id')
    .eq('bank_transaction_reference', transactionReference)
    .neq('id', id)
    .maybeSingle();
  if (duplicate) {
    return NextResponse.json({ message: 'เลขอ้างอิงนี้ถูกใช้กับรายการอื่นแล้ว' }, { status: 409 });
  }

  try {
    const result = await finalizeMarketplacePayment({
      paymentSessionId: id,
      allowedStatuses: ['payment_review'],
      reviewedBy: caller.sub,
      bankTransactionReference: transactionReference,
    });
    return NextResponse.json({ success: true, availableAt: result.availableAt });
  } catch (finalizeError) {
    return NextResponse.json(
      {
        message:
          finalizeError instanceof Error ? finalizeError.message : 'ยืนยันการชำระเงินไม่สำเร็จ',
      },
      { status: 500 }
    );
  }
}
