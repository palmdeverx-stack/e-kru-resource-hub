import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { createNotifications } from 'src/lib/notifications';

import { getProductEngagement } from 'src/sections/marketplace/catalog/server/product-engagement';

type Context = { params: Promise<{ id: string; reviewId: string }> };

export async function POST(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  if (!caller) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบก่อนตอบกลับรีวิว' }, { status: 401 });
  }

  const { id: productId, reviewId } = await params;
  const body = await request.json().catch(() => null);
  const comment = String(body?.comment ?? '').trim();
  if (comment.length < 1 || comment.length > 1000) {
    return NextResponse.json(
      { message: 'ข้อความตอบกลับต้องมี 1–1,000 ตัวอักษร' },
      { status: 400 }
    );
  }

  const [{ data: product }, { data: review }] = await Promise.all([
    supabaseAdmin
      .from('marketplace_products')
      .select('id, seller:marketplace_sellers!inner(id, owner_id, display_name)')
      .eq('id', productId)
      .maybeSingle(),
    supabaseAdmin
      .from('marketplace_product_reviews')
      .select('id, buyer_id')
      .eq('id', reviewId)
      .eq('product_id', productId)
      .maybeSingle(),
  ]);
  const sellerRelation = product?.seller;
  const seller = Array.isArray(sellerRelation) ? sellerRelation[0] : sellerRelation;
  if (!product || !review) {
    return NextResponse.json({ message: 'ไม่พบรีวิว' }, { status: 404 });
  }
  if (!seller || seller.owner_id !== caller.sub) {
    return NextResponse.json(
      { message: 'เฉพาะเจ้าของร้านสินค้านี้เท่านั้นที่ตอบกลับรีวิวได้' },
      { status: 403 }
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('marketplace_review_replies').upsert(
    {
      review_id: reviewId,
      seller_id: seller.id,
      responder_id: caller.sub,
      responder_name: seller.display_name,
      comment,
      updated_at: now,
    },
    { onConflict: 'review_id' }
  );
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  await createNotifications([
    {
      userId: review.buyer_id,
      schoolId: null,
      type: 'marketplace_review_replied',
      title: 'ร้านค้าตอบกลับรีวิวของคุณ',
      body: `${seller.display_name}: ${comment.slice(0, 160)}`,
      link: `/product/${productId}`,
    },
  ]);

  const engagement = await getProductEngagement(productId, caller.sub);
  return NextResponse.json({ engagement, message: 'ตอบกลับรีวิวเรียบร้อยแล้ว' });
}
