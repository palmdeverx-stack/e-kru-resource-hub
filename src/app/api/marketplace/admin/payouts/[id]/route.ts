import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { createNotifications } from 'src/lib/notifications';
import { writeSecurityAudit } from 'src/lib/security-audit';
import { requireRole, hasPayoutAccess } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireRole(request, ['master_admin']);
  if (!caller)
    return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการการโอนเงิน' }, { status: 403 });
  if (!hasPayoutAccess(request, caller.sub)) {
    return NextResponse.json({ message: 'กรุณายืนยันรหัสเข้าใช้งานอีกครั้ง' }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status;
  const reference = String(body?.transferReference ?? '')
    .trim()
    .toUpperCase();
  const reason = String(body?.failureReason ?? '').trim();
  if (!['processing', 'paid', 'failed'].includes(status)) {
    return NextResponse.json({ message: 'สถานะไม่ถูกต้อง' }, { status: 400 });
  }
  if (status === 'paid' && (reference.length < 4 || reference.length > 100)) {
    return NextResponse.json({ message: 'เลขอ้างอิงต้องมี 4–100 ตัวอักษร' }, { status: 400 });
  }
  if (status === 'failed' && reason.length < 3) {
    return NextResponse.json({ message: 'กรุณาระบุสาเหตุที่โอนไม่สำเร็จ' }, { status: 400 });
  }
  const { data: result, error } = await supabaseAdmin.rpc('finish_marketplace_seller_payout', {
    p_payout_id: id,
    p_status: status,
    p_reference: reference,
    p_reason: reason,
    p_processed_by: caller.sub,
  });
  if (error || !result) {
    const missingMigration = error?.code === 'PGRST202' || error?.code === '42883';
    const duplicate = error?.code === '23505';
    return NextResponse.json(
      {
        message: duplicate
          ? 'เลขอ้างอิงนี้ถูกใช้กับรายการโอนอื่นแล้ว'
          : missingMigration
            ? 'ยังไม่ได้ติดตั้ง migration ระบบโอนเงินแบบ transaction'
            : error?.code === 'P0001'
              ? 'รายการหรือยอดจองเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่และตรวจสอบก่อนโอน'
              : 'บันทึกผลการโอนไม่สำเร็จ กรุณาลองใหม่',
      },
      {
        status: missingMigration
          ? 503
          : duplicate || error?.code === 'P0001'
            ? 409
            : error?.code === 'P0002'
              ? 404
              : 500,
      }
    );
  }
  if (result.already_processed) return NextResponse.json({ success: true, alreadyProcessed: true });
  const payout = result.payout;
  // Financial changes have committed atomically. Secondary channel failures must
  // not make the caller believe the bank-result write failed and submit again.
  const sideEffects: Promise<unknown>[] = [
    writeSecurityAudit({
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
    }),
  ];
  if (result.owner_id && status !== 'processing') {
    sideEffects.push(
      createNotifications([
        {
          userId: result.owner_id,
          schoolId: null,
          type: `marketplace_payout_${status}`,
          title: status === 'paid' ? 'โอนรายได้ให้คุณแล้ว' : 'การโอนรายได้ไม่สำเร็จ',
          body:
            status === 'paid'
              ? `ยอด ${Number(payout.amount).toLocaleString('th-TH')} บาท อ้างอิง ${reference}`
              : reason,
          link: '/dashboard/seller/finance',
        },
      ])
    );
  }
  await Promise.allSettled(sideEffects);
  return NextResponse.json({ success: true });
}
