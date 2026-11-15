import * as z from 'zod';
import { NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { writeSecurityAudit } from 'src/lib/security-audit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import { requireRole, isActiveTokenAccount } from 'src/lib/auth-token';

const schema = z.object({
  action: z.enum(['hide', 'show', 'suspend', 'restore']),
  reason: z.string().trim().min(3).max(1000),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireRole(request, ['master_admin']);
  if (!caller || !(await isActiveTokenAccount(caller))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการสถานะร้านค้า' }, { status: 403 });
  }
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { message: 'กรุณาเลือกคำสั่งและระบุเหตุผล 3–1,000 ตัวอักษร' },
      { status: 400 }
    );
  }
  const { id } = await params;
  const { data: seller, error: findError } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, status, is_hidden, owner_role')
    .eq('id', id)
    .maybeSingle();
  if (findError)
    return NextResponse.json({ message: 'โหลดสถานะร้านค้าไม่สำเร็จ' }, { status: 500 });
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });
  if (seller.owner_role === 'master_admin') {
    return NextResponse.json(
      { message: 'ไม่สามารถเปลี่ยนสถานะร้านระบบ E-KRU ได้' },
      { status: 403 }
    );
  }
  const { action, reason } = body.data;
  const valid =
    action === 'restore'
      ? seller.status === 'suspended'
      : seller.status === 'active' &&
        (action === 'suspend' || seller.is_hidden === (action === 'show'));
  if (!valid)
    return NextResponse.json(
      { message: 'สถานะร้านเปลี่ยนไป กรุณาโหลดข้อมูลใหม่' },
      { status: 409 }
    );
  const nextStatus =
    action === 'suspend' ? 'suspended' : action === 'restore' ? 'active' : seller.status;
  const nextHidden = action === 'hide' ? true : action === 'show' ? false : seller.is_hidden;
  const { data: updated, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .update({
      status: nextStatus,
      is_hidden: nextHidden,
      moderation_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', seller.status)
    .eq('is_hidden', seller.is_hidden)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ message: 'บันทึกสถานะร้านค้าไม่สำเร็จ' }, { status: 500 });
  if (!updated)
    return NextResponse.json(
      { message: 'สถานะร้านเปลี่ยนไป กรุณาโหลดข้อมูลใหม่' },
      { status: 409 }
    );
  revalidateTag('public-store-directory', { expire: 0 });
  revalidatePath('/sitemap.xml');
  revalidatePath('/store/[slug]', 'page');
  revalidatePath('/product/[id]', 'page');
  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'admin',
    action: `marketplace.seller_${action}`,
    targetType: 'marketplace_seller',
    targetId: id,
    result: 'success',
    metadata: { reason, previous_status: seller.status, status: nextStatus, is_hidden: nextHidden },
  });
  return NextResponse.json({ message: 'บันทึกสถานะร้านค้าเรียบร้อยแล้ว' });
}
