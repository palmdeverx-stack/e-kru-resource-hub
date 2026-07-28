import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

export async function GET(request: Request) {
  if (!requireRole(request, ['master_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตรวจสอบการชำระเงิน' }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'payment_review';
  const allowed = ['payment_review', 'verified', 'rejected', 'pending_payment'];
  if (!allowed.includes(status)) {
    return NextResponse.json({ message: 'สถานะไม่ถูกต้อง' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('marketplace_payment_sessions')
    .select(
      '*, orders:marketplace_orders(*, seller:marketplace_sellers(id, display_name), items:marketplace_order_items(id, title, unit_price, quantity))'
    )
    .eq('status', status)
    .order('submitted_at', { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const sessions = await Promise.all(
    (data ?? []).map(async (session) => {
      if (!session.slip_path) return { ...session, slipUrl: null };
      const { data: signed } = await supabaseAdmin.storage
        .from('marketplace-payment-slips')
        .createSignedUrl(session.slip_path, 15 * 60);
      return { ...session, slipUrl: signed?.signedUrl ?? null };
    })
  );
  return NextResponse.json({ paymentSessions: sessions });
}
