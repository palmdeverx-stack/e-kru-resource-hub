import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const reviewer = requireRole(request, ['master_admin']);
  if (!reviewer) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์อนุมัติร้านค้า' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const action = String(body.action ?? '');
  const reason = String(body.reason ?? '').trim();

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ message: 'คำสั่งตรวจสอบร้านค้าไม่ถูกต้อง' }, { status: 400 });
  }
  if (action === 'reject' && reason.length < 3) {
    return NextResponse.json({ message: 'กรุณาระบุเหตุผลที่ปฏิเสธอย่างน้อย 3 ตัวอักษร' }, { status: 400 });
  }

  const { data: existingSeller, error: findError } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (findError || !existingSeller) {
    return NextResponse.json(
      { message: findError?.message ?? 'ไม่พบคำขอเปิดร้าน' },
      { status: findError ? 500 : 404 }
    );
  }
  if (existingSeller.owner_role === 'master_admin') {
    return NextResponse.json({ message: 'ไม่สามารถเปลี่ยนสถานะร้านระบบ eKru ได้' }, { status: 400 });
  }

  if (action === 'approve') {
    const [{ data: documents }, { data: payoutAccount }] = await Promise.all([
      supabaseAdmin
        .from('marketplace_seller_documents')
        .select('document_type')
        .eq('seller_id', id),
      supabaseAdmin
        .from('marketplace_seller_payout_accounts')
        .select('seller_id')
        .eq('seller_id', id)
        .maybeSingle(),
    ]);
    const types = new Set((documents ?? []).map((document) => document.document_type));
    if (
      existingSeller.status !== 'pending' ||
      !existingSeller.logo_url ||
      !existingSeller.seller_name ||
      !existingSeller.phone ||
      !existingSeller.contact_email ||
      !payoutAccount ||
      !types.has('identity_card') ||
      !types.has('bank_book') ||
      !existingSeller.seller_agreement_accepted_at ||
      !existingSeller.copyright_confirmed_at ||
      !existingSeller.fee_agreement_accepted_at ||
      !existingSeller.pdpa_accepted_at
    ) {
      return NextResponse.json(
        { message: 'ข้อมูล บัญชี เอกสาร หรือข้อตกลงของผู้ขายยังไม่ครบ' },
        { status: 400 }
      );
    }
  }

  const now = new Date().toISOString();
  const { data: seller, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .update({
      status: action === 'approve' ? 'active' : 'rejected',
      reviewed_at: now,
      reviewed_by: reviewer.sub,
      rejection_reason: action === 'reject' ? reason : null,
      updated_at: now,
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error || !seller) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบคำขอเปิดร้าน' },
      { status: error ? 500 : 404 }
    );
  }

  if (action === 'approve') {
    await supabaseAdmin
      .from('marketplace_seller_payout_accounts')
      .update({ is_verified: true, verified_at: now, verified_by: reviewer.sub, updated_at: now })
      .eq('seller_id', id);
  }

  return NextResponse.json({ seller });
}
