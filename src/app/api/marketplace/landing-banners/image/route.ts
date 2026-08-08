import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import { optimizeUploadedImage } from 'src/lib/server-image-optimizer';

const BUCKET = 'marketplace-landing-banner-assets';
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์อัปโหลดรูปแบนเนอร์' }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const variant = form?.get('variant') === 'mobile' ? 'mobile' : 'desktop';
  if (
    !(file instanceof File) ||
    !IMAGE_TYPES.has(file.type) ||
    file.size < 1 ||
    file.size > 5 * 1024 * 1024
  ) {
    return NextResponse.json(
      { message: 'รองรับเฉพาะ JPG, PNG, WEBP ขนาดไม่เกิน 5 MB' },
      { status: 400 }
    );
  }

  try {
    const image = await optimizeUploadedImage(file, { preset: 'content' });
    const path = `${caller.sub}/${variant}/${crypto.randomUUID()}.${image.extension}`;
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, image.data, {
      contentType: image.contentType,
      upsert: false,
    });
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    const url = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ url, size: image.size });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'อัปโหลดรูปไม่สำเร็จ' },
      { status: 400 }
    );
  }
}
