import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { optimizeUploadedImage } from 'src/lib/server-image-optimizer';

import {
  hasPurchasedProduct,
  getProductEngagement,
} from 'src/sections/marketplace/catalog/server/product-engagement';

type Context = { params: Promise<{ id: string }> };
const REVIEW_IMAGE_BUCKET = 'marketplace-review-images';
const MAX_REVIEW_IMAGES = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  if (!caller) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบก่อนให้คะแนน' }, { status: 401 });
  }

  const { id: productId } = await params;
  const isMultipart = request.headers.get('content-type')?.includes('multipart/form-data');
  const formData = isMultipart ? await request.formData().catch(() => null) : null;
  const body = !isMultipart ? await request.json().catch(() => null) : null;
  const rating = Number(formData?.get('rating') ?? body?.rating);
  const comment = String(formData?.get('comment') ?? body?.comment ?? '').trim();
  const uploadedImages = (formData?.getAll('images') ?? []).filter(
    (entry): entry is File => entry instanceof File && entry.size > 0
  );
  const requestedKeepIds = new Set(
    (formData?.getAll('keepImageIds') ?? []).map((entry) => String(entry))
  );

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ message: 'กรุณาให้คะแนนตั้งแต่ 1–5 ดาว' }, { status: 400 });
  }
  if (comment.length > 1000) {
    return NextResponse.json({ message: 'รีวิวต้องไม่เกิน 1,000 ตัวอักษร' }, { status: 400 });
  }
  if (
    uploadedImages.length > MAX_REVIEW_IMAGES ||
    uploadedImages.some((image) => !IMAGE_EXTENSIONS[image.type] || image.size > MAX_IMAGE_BYTES)
  ) {
    return NextResponse.json(
      { message: 'แนบรูปได้สูงสุด 3 รูป รองรับ JPG, PNG, WEBP ขนาดไม่เกิน 5 MB ต่อรูป' },
      { status: 400 }
    );
  }

  const { data: product } = await supabaseAdmin
    .from('marketplace_products')
    .select('id')
    .eq('id', productId)
    .in('status', ['published', 'archived'])
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
    .select('id, images:marketplace_review_images(id, storage_bucket, storage_path, position)')
    .eq('product_id', productId)
    .eq('buyer_id', caller.sub)
    .maybeSingle();

  const existingImages =
    (existingReview?.images as Array<{
      id: string;
      storage_bucket: string;
      storage_path: string;
      position: number;
    }> | null) ?? [];
  const keptImages = isMultipart
    ? existingImages.filter((image) => requestedKeepIds.has(image.id))
    : existingImages;
  if (keptImages.length + uploadedImages.length > MAX_REVIEW_IMAGES) {
    return NextResponse.json({ message: 'แนบรูปรีวิวได้สูงสุด 3 รูป' }, { status: 400 });
  }

  const reviewId = existingReview?.id ?? crypto.randomUUID();
  const newStorageRows: Array<{
    review_id: string;
    storage_bucket: string;
    storage_path: string;
    mime_type: string;
    file_size: number;
    position: number;
  }> = [];
  for (const [index, image] of uploadedImages.entries()) {
    const optimizedImage = await optimizeUploadedImage(image, { preset: 'content' });
    const storagePath = `${productId}/${reviewId}/${crypto.randomUUID()}.${optimizedImage.extension}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(REVIEW_IMAGE_BUCKET)
      .upload(storagePath, optimizedImage.data, {
        contentType: optimizedImage.contentType,
        upsert: false,
      });
    if (uploadError) {
      if (newStorageRows.length) {
        await supabaseAdmin.storage
          .from(REVIEW_IMAGE_BUCKET)
          .remove(newStorageRows.map((row) => row.storage_path));
      }
      return NextResponse.json({ message: uploadError.message }, { status: 500 });
    }
    newStorageRows.push({
      review_id: reviewId,
      storage_bucket: REVIEW_IMAGE_BUCKET,
      storage_path: storagePath,
      mime_type: optimizedImage.contentType,
      file_size: optimizedImage.size,
      position: keptImages.length + index,
    });
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('marketplace_product_reviews').upsert(
    {
      id: reviewId,
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
    if (newStorageRows.length) {
      await supabaseAdmin.storage
        .from(REVIEW_IMAGE_BUCKET)
        .remove(newStorageRows.map((row) => row.storage_path));
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  if (newStorageRows.length) {
    const { error: imageInsertError } = await supabaseAdmin
      .from('marketplace_review_images')
      .insert(newStorageRows);
    if (imageInsertError) {
      await supabaseAdmin.storage
        .from(REVIEW_IMAGE_BUCKET)
        .remove(newStorageRows.map((row) => row.storage_path));
      return NextResponse.json({ message: imageInsertError.message }, { status: 500 });
    }
  }

  const removedImages = existingImages.filter(
    (image) => !keptImages.some((kept) => kept.id === image.id)
  );
  if (removedImages.length) {
    await supabaseAdmin.storage
      .from(REVIEW_IMAGE_BUCKET)
      .remove(removedImages.map((image) => image.storage_path));
    await supabaseAdmin
      .from('marketplace_review_images')
      .delete()
      .in(
        'id',
        removedImages.map((image) => image.id)
      );
  }

  const engagement = await getProductEngagement(productId, caller.sub);
  return NextResponse.json({
    engagement,
    message: existingReview ? 'แก้ไขรีวิวเรียบร้อยแล้ว' : 'เผยแพร่รีวิวเรียบร้อยแล้ว',
  });
}
