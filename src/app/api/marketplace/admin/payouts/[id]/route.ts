import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { createNotifications } from 'src/lib/notifications';
import { writeSecurityAudit } from 'src/lib/security-audit';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการการโอนเงิน' }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status;
  const reference = String(body?.transferReference ?? '').trim();
  const reason = String(body?.failureReason ?? '').trim();
  if (!['paid', 'failed'].includes(status)) {
    return NextResponse.json({ message: 'สถานะไม่ถูกต้อง' }, { status: 400 });
  }
  if (status === 'paid' && reference.length < 4) {
    return NextResponse.json({ message: 'กรุณาระบุเลขอ้างอิงการโอน' }, { status: 400 });
  }
  if (status === 'failed' && reason.length < 3) {
    return NextResponse.json({ message: 'กรุณาระบุสาเหตุที่โอนไม่สำเร็จ' }, { status: 400 });
  }

  const { data: payout } = await supabaseAdmin
    .from('marketplace_payouts')
    .select('*, seller:marketplace_sellers(owner_id)')
    .eq('id', id)
    .in('status', ['pending', 'processing'])
    .maybeSingle();
  if (!payout) {
    return NextResponse.json({ message: 'รายการนี้ดำเนินการไปแล้ว' }, { status: 409 });
  }
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('marketplace_payouts')
    .update({
      status,
      transfer_reference: status === 'paid' ? reference : null,
      failure_reason: status === 'failed' ? reason : null,
      processed_at: now,
      processed_by: caller.sub,
      updated_at: now,
    })
    .eq('id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  if (status === 'failed') {
    await supabaseAdmin
      .from('marketplace_ledger_entries')
      .update({ payout_id: null })
      .eq('payout_id', id);
  }
  const seller = Array.isArray(payout.seller) ? payout.seller[0] : payout.seller;
  if (seller?.owner_id) {
    await createNotifications([
      {
        userId: seller.owner_id,
        schoolId: null,
        type: `marketplace_payout_${status}`,
        title: status === 'paid' ? 'โอนรายได้ให้คุณแล้ว' : 'การโอนรายได้ไม่สำเร็จ',
        body:
          status === 'paid'
            ? `ยอด ${Number(payout.amount).toLocaleString('th-TH')} บาท อ้างอิง ${reference}`
            : reason,
        link: '/dashboard/seller/finance',
      },
    ]);
  }
  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'admin',
    action: `marketplace.payout_${status}`,
    targetType: 'marketplace_payout',
    targetId: id,
    result: 'success',
    metadata: {
      amount: Number(payout.amount),
      ...(status === 'paid' ? { transfer_reference: reference } : { reason }),
    },
  });
  return NextResponse.json({ success: true });
}
