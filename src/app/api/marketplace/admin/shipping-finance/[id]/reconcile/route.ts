import { NextResponse } from 'next/server';

import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { writeSecurityAudit } from 'src/lib/security-audit';
import { requireRole, hasPayoutAccess } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { reconcileShippingProviderFee } from 'src/sections/marketplace/shipping/server/accounting';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireRole(request, ['master_admin']);
  if (!caller)
    return NextResponse.json({ message: 'ไม่มีสิทธิ์กระทบยอดค่าจัดส่ง' }, { status: 403 });
  if (!hasPayoutAccess(request, caller.sub)) {
    return NextResponse.json(
      { message: 'กรุณายืนยัน PIN เพื่อกระทบยอดค่าจัดส่ง' },
      { status: 401 }
    );
  }
  if (
    !(await isActionAllowed({
      request,
      action: 'marketplace-shipping-reconcile',
      subject: caller.sub,
      maxAttempts: 20,
      windowSeconds: 10 * 60,
    }))
  ) {
    return NextResponse.json({ message: 'กระทบยอดบ่อยเกินไป กรุณารอสักครู่' }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const actualFee = Number(body?.actualFee);
  if (!Number.isFinite(actualFee) || actualFee < 0 || actualFee > 100000) {
    return NextResponse.json({ message: 'ค่าขนส่งจริงไม่ถูกต้อง' }, { status: 400 });
  }
  const { id } = await context.params;
  try {
    await reconcileShippingProviderFee({
      shipmentId: id,
      actualFee,
      reference: String(body?.reference ?? '').trim() || null,
      source: 'admin',
      actorId: caller.sub,
    });
    await writeSecurityAudit({
      request,
      actorId: caller.sub,
      actorUsername: caller.username,
      actorRole: caller.role,
      category: 'admin',
      action: 'marketplace.shipping_reconcile',
      targetType: 'shipment',
      targetId: id,
      result: 'success',
      metadata: { actual_fee: actualFee },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'กระทบยอดไม่สำเร็จ' },
      { status: 500 }
    );
  }
}
