import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { createPromptPayPayload } from 'src/sections/marketplace/checkout/server/promptpay';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const { id } = await params;
  const { data: session, error } = await supabaseAdmin
    .from('marketplace_payment_sessions')
    .select(
      '*, orders:marketplace_orders(*, seller:marketplace_sellers(id, display_name), items:marketplace_order_items(id, title, unit_price, quantity))'
    )
    .eq('id', id)
    .eq('buyer_id', caller.sub)
    .maybeSingle();

  if (error || !session) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบรายการชำระเงิน' },
      { status: error ? 500 : 404 }
    );
  }

  let slipUrl: string | null = null;
  if (session.slip_path) {
    const { data } = await supabaseAdmin.storage
      .from('marketplace-payment-slips')
      .createSignedUrl(session.slip_path, 10 * 60);
    slipUrl = data?.signedUrl ?? null;
  }

  let promptpayPayload: string | null = null;
  if (session.payment_method === 'promptpay' && session.promptpay_id_snapshot) {
    try {
      promptpayPayload = createPromptPayPayload(
        session.promptpay_id_snapshot,
        Number(session.amount)
      );
    } catch {
      promptpayPayload = null;
    }
  }

  return NextResponse.json({
    paymentSession: { ...session, promptpayPayload, slipUrl },
  });
}
