import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { refreshedImages } from 'src/sections/marketplace/seller/server/product-media';
import { ownedProduct, ownedSellerId } from 'src/sections/marketplace/seller/server/owned-seller';

type Context = { params: Promise<{ id: string; imageId: string }> };

export async function DELETE(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const seller = await ownedSellerId(caller.sub);
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });

  const { id: productId, imageId } = await params;
  const product = await ownedProduct(productId, seller.id);
  if (!product) return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });

  const { data: image, error } = await supabaseAdmin
    .from('marketplace_product_images')
    .delete()
    .eq('id', imageId)
    .eq('product_id', productId)
    .select('*')
    .maybeSingle();
  if (error || !image) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบรูปภาพ' },
      { status: error ? 500 : 404 }
    );
  }
  await supabaseAdmin.storage.from(image.storage_bucket).remove([image.storage_path]);

  if (image.is_cover) {
    const { data: next } = await supabaseAdmin
      .from('marketplace_product_images')
      .select('id')
      .eq('product_id', productId)
      .order('position')
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabaseAdmin
        .from('marketplace_product_images')
        .update({ is_cover: true })
        .eq('id', next.id);
    }
  }

  return NextResponse.json({ images: await refreshedImages(productId) });
}

export async function PATCH(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const seller = await ownedSellerId(caller.sub);
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });

  const { id: productId, imageId } = await params;
  const product = await ownedProduct(productId, seller.id);
  if (!product) return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });

  const body = await request.json();
  if (body.isCover) {
    await supabaseAdmin
      .from('marketplace_product_images')
      .update({ is_cover: false })
      .eq('product_id', productId)
      .eq('is_cover', true);
    const { error } = await supabaseAdmin
      .from('marketplace_product_images')
      .update({ is_cover: true })
      .eq('id', imageId)
      .eq('product_id', productId);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ images: await refreshedImages(productId) });
}
