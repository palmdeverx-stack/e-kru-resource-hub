import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { getStripe } from 'src/sections/marketplace/checkout/server/stripe';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  if (
    !(await isActionAllowed({
      request,
      action: 'marketplace-payment-cancel',
      subject: caller.sub,
      maxAttempts: 10,
      windowSeconds: 60,
    }))
  ) {
    return NextResponse.json(
      { message: 'ยกเลิกรายการบ่อยเกินไป กรุณาลองใหม่ภายหลัง' },
      { status: 429 }
    );
  }
  const { id } = await params;
  try {
    const { data: session, error } = await supabaseAdmin
      .from('marketplace_payment_sessions')
      .select('id,buyer_id,status,payment_method,stripe_checkout_session_id')
      .eq('id', id)
      .eq('buyer_id', caller.sub)
      .maybeSingle();
    if (error) throw error;
    if (!session) return NextResponse.json({ message: 'ไม่พบรายการชำระเงิน' }, { status: 404 });
    if (
      session.payment_method !== 'stripe' ||
      !['pending_payment', 'expired'].includes(session.status)
    ) {
      return NextResponse.json(
        { message: 'ยกเลิกได้เฉพาะรายการออนไลน์ที่ยังไม่ชำระเงิน' },
        { status: 409 }
      );
    }
    if (!session.stripe_checkout_session_id) {
      return NextResponse.json(
        { message: 'ไม่พบรายการ Stripe กรุณาติดต่อผู้ดูแล' },
        { status: 409 }
      );
    }
    const stripe = getStripe();
    let checkout = await stripe.checkout.sessions.retrieve(session.stripe_checkout_session_id);
    if (checkout.status === 'open') {
      // Stripe decides the race between payment and expiration. Never cancel locally first.
      checkout = await stripe.checkout.sessions.expire(checkout.id);
    }
    if (checkout.status !== 'expired' || checkout.payment_status === 'paid') {
      return NextResponse.json(
        { message: 'รายการนี้ชำระแล้วหรือกำลังประมวลผล ไม่สามารถยกเลิกได้' },
        { status: 409 }
      );
    }
    const now = new Date().toISOString();
    const updated = await supabaseAdmin
      .from('marketplace_payment_sessions')
      .update({ status: 'expired', rejection_reason: 'ผู้ซื้อยกเลิกการชำระเงิน', updated_at: now })
      .eq('id', id)
      .eq('buyer_id', caller.sub)
      .in('status', ['pending_payment', 'expired'])
      .select('id')
      .maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data)
      return NextResponse.json({ message: 'สถานะรายการเปลี่ยนแล้ว กรุณารีเฟรช' }, { status: 409 });
    // One Checkout can contain orders from multiple sellers. Cancel all unpaid orders together.
    const orders = await supabaseAdmin
      .from('marketplace_orders')
      .update({ status: 'cancelled', updated_at: now })
      .eq('payment_session_id', id)
      .eq('buyer_id', caller.sub)
      .in('status', ['pending_payment', 'cancelled'])
      .select('id');
    if (orders.error) throw orders.error;
    if (orders.data?.length) {
      const shipments = await supabaseAdmin
        .from('marketplace_shipments')
        .update({ status: 'cancelled', updated_at: now })
        .in(
          'order_id',
          orders.data.map((order) => order.id)
        )
        .eq('status', 'pending');
      if (shipments.error) throw shipments.error;
    }
    return NextResponse.json({ message: 'ยกเลิกการชำระเงินแล้ว' });
  } catch {
    return NextResponse.json(
      { message: 'ยกเลิกไม่สำเร็จ กรุณารีเฟรชสถานะแล้วลองใหม่' },
      { status: 502 }
    );
  }
}
