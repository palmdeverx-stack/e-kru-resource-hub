import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

export async function GET(request: Request) {
  if (!requireRole(request, ['master_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดูข้อพิพาทการชำระเงิน' }, { status: 403 });
  }

  const disputeId = new URL(request.url).searchParams.get('id');
  if (!disputeId) {
    const { data, error } = await supabaseAdmin
      .from('marketplace_payment_disputes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ disputes: data ?? [] });
  }

  const { data: dispute, error } = await supabaseAdmin
    .from('marketplace_payment_disputes')
    .select('*')
    .eq('id', disputeId)
    .maybeSingle();
  if (error || !dispute) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบข้อพิพาท' },
      { status: error ? 500 : 404 }
    );
  }

  const { data: orders } = dispute.payment_session_id
    ? await supabaseAdmin
        .from('marketplace_orders')
        .select('id')
        .eq('payment_session_id', dispute.payment_session_id)
    : { data: [] };
  const orderIds = (orders ?? []).map((order) => order.id);
  const [{ data: evidence }, { data: usage }, { data: communications }, { data: downloads }] =
    await Promise.all([
      orderIds.length
        ? supabaseAdmin.from('marketplace_order_evidence').select('*').in('order_id', orderIds)
        : Promise.resolve({ data: [] }),
      orderIds.length
        ? supabaseAdmin
            .from('marketplace_entitlement_usage_events')
            .select('*')
            .in('order_id', orderIds)
            .order('occurred_at')
        : Promise.resolve({ data: [] }),
      orderIds.length
        ? supabaseAdmin
            .from('marketplace_customer_communications')
            .select('*')
            .in('order_id', orderIds)
            .order('occurred_at')
        : Promise.resolve({ data: [] }),
      orderIds.length
        ? supabaseAdmin
            .from('marketplace_product_downloads')
            .select('*, order_item:marketplace_order_items!inner(order_id)')
            .in('order_item.order_id', orderIds)
        : Promise.resolve({ data: [] }),
    ]);

  return NextResponse.json({
    dispute,
    evidence: evidence ?? [],
    usage: usage ?? [],
    communications: communications ?? [],
    downloads: downloads ?? [],
  });
}
