import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

const BUCKET = 'marketplace-announcement-assets';
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์อัปโหลดรูปประกาศ' }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (
    !(file instanceof File) ||
    !EXTENSIONS[file.type] ||
    file.size < 1 ||
    file.size > 5 * 1024 * 1024
  ) {
    return NextResponse.json(
      { message: 'รองรับเฉพาะ JPG, PNG, WEBP ขนาดไม่เกิน 5 MB' },
      { status: 400 }
    );
  }

  const path = `${caller.sub}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const url = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ url });
}

