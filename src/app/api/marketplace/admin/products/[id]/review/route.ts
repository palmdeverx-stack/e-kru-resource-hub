import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const reviewer = requireRole(request, ['master_admin']);
  if (!reviewer) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์อนุมัติสินค้า' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const action = String(body.action ?? '');
  const reason = String(body.reason ?? '').trim();

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ message: 'คำสั่งตรวจสอบสินค้าไม่ถูกต้อง' }, { status: 400 });
  }
  if (action === 'reject' && reason.length < 3) {
    return NextResponse.json({ message: 'กรุณาระบุเหตุผลที่ปฏิเสธ' }, { status: 400 });
  }

  const { data: product, error } = await supabaseAdmin
    .from('marketplace_products')
    .update({
      status: action === 'approve' ? 'published' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer.sub,
      rejection_reason: action === 'reject' ? reason : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error || !product) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบสินค้า' },
      { status: error ? 500 : 404 }
    );
  }

  return NextResponse.json({ product });
}
