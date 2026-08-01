import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการใบเสร็จรับเงิน' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? '');
  const reason = String(body?.reason ?? '').trim();
  if (action !== 'void' || reason.length < 3) {
    return NextResponse.json(
      { message: 'กรุณาระบุเหตุผลยกเลิกใบเสร็จอย่างน้อย 3 ตัวอักษร' },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('marketplace_receipts')
    .update({
      status: 'void',
      voided_at: now,
      voided_by: caller.sub,
      void_reason: reason,
      updated_at: now,
    })
    .eq('id', id)
    .eq('status', 'issued')
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json(
      { message: 'ไม่พบใบเสร็จ หรือใบเสร็จนี้ถูกยกเลิกแล้ว' },
      { status: 409 }
    );
  }
  return NextResponse.json({ receipt: data });
}

