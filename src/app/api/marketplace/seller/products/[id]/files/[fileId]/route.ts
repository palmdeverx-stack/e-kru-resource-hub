import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { refreshedFiles } from 'src/sections/marketplace/seller/server/product-media';
import { ownedProduct, ownedSellerId } from 'src/sections/marketplace/seller/server/owned-seller';

type Context = { params: Promise<{ id: string; fileId: string }> };

export async function DELETE(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const seller = await ownedSellerId(caller.sub);
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });

  const { id: productId, fileId } = await params;
  const product = await ownedProduct(productId, seller.id);
  if (!product) return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });

  const { data: file, error } = await supabaseAdmin
    .from('marketplace_product_files')
    .delete()
    .eq('id', fileId)
    .eq('product_id', productId)
    .select('*')
    .maybeSingle();
  if (error || !file) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบไฟล์' },
      { status: error ? 500 : 404 }
    );
  }
  await supabaseAdmin.storage.from(file.storage_bucket).remove([file.storage_path]);

  return NextResponse.json({ files: await refreshedFiles(productId) });
}

export async function PATCH(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const seller = await ownedSellerId(caller.sub);
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });

  const { id: productId, fileId } = await params;
  const product = await ownedProduct(productId, seller.id);
  if (!product) return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });

  const body = await request.json();
  const { error } = await supabaseAdmin
    .from('marketplace_product_files')
    .update({ is_preview: Boolean(body.isPreview) })
    .eq('id', fileId)
    .eq('product_id', productId);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ files: await refreshedFiles(productId) });
}
