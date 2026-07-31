import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { writeSecurityAudit } from 'src/lib/security-audit';

import {
  withMediaUrls,
  PRODUCT_MANAGE_SELECT,
} from 'src/sections/marketplace/seller/server/product-media';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  if (!requireRole(request, ['master_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตรวจสอบสินค้า' }, { status: 403 });
  }

  const { id } = await params;
  const { data: product, error } = await supabaseAdmin
    .from('marketplace_products')
    .select(
      `${PRODUCT_MANAGE_SELECT}, seller:marketplace_sellers(id, display_name, display_name_en, seller_type, slug, logo_url, bio, contact_email), media_type:marketplace_media_types(id, name, delivery_mode), sale_type:marketplace_sale_types(id, name, pricing_mode)`
    )
    .eq('id', id)
    .maybeSingle();
  if (error || !product) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบสินค้า' },
      { status: error ? 500 : 404 }
    );
  }

  const { data: reviewHistory, error: historyError } = await supabaseAdmin
    .from('marketplace_product_review_submissions')
    .select(
      'id, submission_number, product_title_snapshot, status, submitted_at, reviewed_at, reviewed_by, rejection_reason'
    )
    .eq('product_id', id)
    .order('submission_number', { ascending: false });
  if (historyError) {
    return NextResponse.json({ message: historyError.message }, { status: 500 });
  }

  return NextResponse.json({
    product: {
      ...(await withMediaUrls(product)),
      submission_count: reviewHistory?.length ?? 0,
      review_history: reviewHistory ?? [],
    },
  });
}

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

  await writeSecurityAudit({
    request,
    actorId: reviewer.sub,
    actorUsername: reviewer.username,
    actorRole: reviewer.role,
    category: 'admin',
    action: `marketplace.product_${action}`,
    targetType: 'marketplace_product',
    targetId: id,
    result: 'success',
    metadata: {
      new_status: product.status,
      ...(action === 'reject' && { reason }),
    },
  });

  return NextResponse.json({ product });
}
