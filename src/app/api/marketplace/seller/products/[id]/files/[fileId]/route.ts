import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { refreshedFiles } from 'src/sections/marketplace/seller/server/product-media';
import { removeProductFiles } from 'src/sections/marketplace/seller/server/product-file-storage';
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
  await removeProductFiles(file.storage_bucket, [file.storage_path]);

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

  const body = await request.json().catch(() => null);
  if (typeof body?.isPreview !== 'boolean') {
    return NextResponse.json({ message: 'ประเภทไฟล์ไม่ถูกต้อง' }, { status: 400 });
  }
  const isPreview = body.isPreview;
  const { data: file, error: fileError } = await supabaseAdmin
    .from('marketplace_product_files')
    .select('id, file_size')
    .eq('id', fileId)
    .eq('product_id', productId)
    .maybeSingle();
  if (fileError) return NextResponse.json({ message: fileError.message }, { status: 500 });
  if (!file) return NextResponse.json({ message: 'ไม่พบไฟล์' }, { status: 404 });
  const { count, error: countError } = await supabaseAdmin
    .from('marketplace_product_files')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)
    .eq('is_preview', isPreview)
    .neq('id', fileId);
  if (countError) return NextResponse.json({ message: countError.message }, { status: 500 });
  if (Number(file.file_size) > 10 * 1024 * 1024 || (count ?? 0) >= (isPreview ? 1 : 5)) {
    return NextResponse.json(
      {
        message: isPreview
          ? 'ไฟล์ตัวอย่างสูงสุด 1 ไฟล์ ขนาดไม่เกิน 10 MB'
          : 'ไฟล์จริงสูงสุด 5 ไฟล์ ไฟล์ละไม่เกิน 10 MB',
      },
      { status: 400 }
    );
  }
  const { error } = await supabaseAdmin
    .from('marketplace_product_files')
    .update({ is_preview: isPreview })
    .eq('id', fileId)
    .eq('product_id', productId);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ files: await refreshedFiles(productId) });
}
