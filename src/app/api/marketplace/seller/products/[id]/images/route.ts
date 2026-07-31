import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { optimizeUploadedImage } from 'src/lib/server-image-optimizer';

import { refreshedImages } from 'src/sections/marketplace/seller/server/product-media';
import { ownedProduct, ownedSellerId } from 'src/sections/marketplace/seller/server/owned-seller';

const BUCKET = 'marketplace-product-covers';
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 10;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const seller = await ownedSellerId(caller.sub);
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });

  const { id: productId } = await params;
  const product = await ownedProduct(productId, seller.id);
  if (!product) return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });

  const formData = await request.formData();
  const files = formData
    .getAll('files')
    .filter((file): file is File => file instanceof File && file.size > 0);
  if (!files.length) {
    return NextResponse.json({ message: 'กรุณาเลือกไฟล์รูปภาพ' }, { status: 400 });
  }

  const invalid = files.find((file) => !ACCEPTED_TYPES.has(file.type) || file.size > MAX_SIZE);
  if (invalid) {
    return NextResponse.json(
      { message: `ไฟล์ "${invalid.name}" ต้องเป็น JPG, PNG หรือ WebP ขนาดไม่เกิน 5MB` },
      { status: 400 }
    );
  }

  const { count: existingCount } = await supabaseAdmin
    .from('marketplace_product_images')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', productId);
  if ((existingCount ?? 0) + files.length > MAX_IMAGES) {
    return NextResponse.json(
      { message: `อัปโหลดรูปปกได้สูงสุด ${MAX_IMAGES} รูปต่อสินค้า` },
      { status: 400 }
    );
  }

  const { data: maxPositionRow } = await supabaseAdmin
    .from('marketplace_product_images')
    .select('position')
    .eq('product_id', productId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextPosition = (maxPositionRow?.position ?? -1) + 1;
  const isFirstEver = (existingCount ?? 0) === 0;

  const uploadedPaths: string[] = [];
  const rows: Record<string, unknown>[] = [];
  try {
    for (const file of files) {
      const image = await optimizeUploadedImage(file, { preset: 'content' });
      const path = `${productId}/image-${crypto.randomUUID()}.${image.extension}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, image.data, { contentType: image.contentType });
      if (uploadError) throw new Error(uploadError.message);
      uploadedPaths.push(path);
      rows.push({
        product_id: productId,
        storage_bucket: BUCKET,
        storage_path: path,
        file_name: file.name.slice(0, 255),
        mime_type: image.contentType,
        file_size: image.size,
        position: nextPosition++,
        is_cover: isFirstEver && rows.length === 0,
      });
    }
    const { error: insertError } = await supabaseAdmin
      .from('marketplace_product_images')
      .insert(rows);
    if (insertError) throw new Error(insertError.message);
  } catch (uploadError) {
    if (uploadedPaths.length) await supabaseAdmin.storage.from(BUCKET).remove(uploadedPaths);
    return NextResponse.json(
      { message: uploadError instanceof Error ? uploadError.message : 'อัปโหลดรูปปกไม่สำเร็จ' },
      { status: 500 }
    );
  }

  return NextResponse.json({ images: await refreshedImages(productId) });
}
