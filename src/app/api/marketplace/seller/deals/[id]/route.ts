import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { ownedSellerId } from 'src/sections/marketplace/seller/server/owned-seller';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const seller = await ownedSellerId(caller.sub);
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? '');
  const nextStatus = action === 'send' ? 'sent' : action === 'cancel' ? 'cancelled' : '';
  if (!nextStatus) return NextResponse.json({ message: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });

  let query = supabaseAdmin
    .from('marketplace_sales_deals')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('seller_id', seller.id);
  query =
    action === 'send'
      ? query.in('status', ['draft', 'sent'])
      : query.in('status', ['draft', 'sent', 'viewed']);
  const { data, error } = await query.select('*').maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถเปลี่ยนสถานะข้อเสนอได้' },
      { status: error ? 500 : 409 }
    );
  }
  return NextResponse.json({ deal: data });
}
