import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import {
  hasPurchasedProduct,
  getProductEngagement,
} from 'src/sections/marketplace/catalog/server/product-engagement';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  if (!caller) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบก่อนให้คะแนน' }, { status: 401 });
  }

  const { id: productId } = await params;
  const body = await request.json().catch(() => null);
  const rating = Number(body?.rating);
  const comment = String(body?.comment ?? '').trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ message: 'กรุณาให้คะแนนตั้งแต่ 1–5 ดาว' }, { status: 400 });
  }
  if (comment.length > 1000) {
    return NextResponse.json({ message: 'รีวิวต้องไม่เกิน 1,000 ตัวอักษร' }, { status: 400 });
  }

  const { data: product } = await supabaseAdmin
    .from('marketplace_products')
    .select('id')
    .eq('id', productId)
    .eq('status', 'published')
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });
  }

  if (!(await hasPurchasedProduct(productId, caller.sub))) {
    return NextResponse.json(
      { message: 'ให้คะแนนได้หลังจากซื้อและชำระเงินสำเร็จแล้วเท่านั้น' },
      { status: 403 }
    );
  }

  const { data: existingReview } = await supabaseAdmin
    .from('marketplace_product_reviews')
    .select('id')
    .eq('product_id', productId)
    .eq('buyer_id', caller.sub)
    .maybeSingle();

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('marketplace_product_reviews').upsert(
    {
      product_id: productId,
      buyer_id: caller.sub,
      reviewer_name: caller.username,
      rating,
      comment: comment || null,
      updated_at: now,
    },
    { onConflict: 'product_id,buyer_id' }
  );
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const engagement = await getProductEngagement(productId, caller.sub);
  return NextResponse.json({
    engagement,
    message: existingReview ? 'แก้ไขรีวิวเรียบร้อยแล้ว' : 'เผยแพร่รีวิวเรียบร้อยแล้ว',
  });
}
