import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { optimizeUploadedImage } from 'src/lib/server-image-optimizer';

const BUCKET = 'marketplace-platform-assets';
const ASSET_TYPES = new Set([
  'logo',
  'transparent-logo',
  'favicon',
  'og-image',
  'official-product-thumbnail',
  'signature',
  'seal',
]);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: Request) {
  const caller = requireRole(request, ['master_admin', 'super_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์อัปโหลดไฟล์แพลตฟอร์ม' }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const assetType = String(form?.get('assetType') ?? '');
  const maxSize = assetType === 'favicon' ? 1024 * 1024 : 5 * 1024 * 1024;
  if (
    !(file instanceof File) ||
    !ASSET_TYPES.has(assetType) ||
    !IMAGE_TYPES.has(file.type) ||
    file.size < 1 ||
    file.size > maxSize
  ) {
    return NextResponse.json(
      {
        message: `รองรับ JPG, PNG และ WEBP ขนาดไม่เกิน ${assetType === 'favicon' ? '1' : '5'} MB`,
      },
      { status: 400 }
    );
  }

  try {
    const optimized = await optimizeUploadedImage(file, {
      preset: assetType === 'favicon' || assetType.includes('logo') ? 'avatar' : 'content',
      output: assetType === 'favicon' ? 'original' : 'webp',
    });
    const path = `${assetType}/${crypto.randomUUID()}.${optimized.extension}`;
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, optimized.data, {
      contentType: optimized.contentType,
      upsert: false,
    });
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    const url = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ url, size: optimized.size });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'อัปโหลดไฟล์ไม่สำเร็จ' },
      { status: 400 }
    );
  }
}
