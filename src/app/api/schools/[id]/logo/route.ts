import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_SIZE = 2 * 1024 * 1024;

export async function POST(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['master_admin', 'school_admin']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;

  if (caller.role !== 'master_admin' && caller.schoolId !== id) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ message: 'กรุณาเลือกไฟล์รูปภาพ' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { message: 'รองรับเฉพาะไฟล์ PNG, JPEG, WEBP หรือ SVG' },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ message: 'ไฟล์ต้องมีขนาดไม่เกิน 2MB' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() || 'png';
  const path = `${id}/logo.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('school-logos')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ message: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from('school-logos').getPublicUrl(path);

  const { data: school, error } = await supabaseAdmin
    .from('schools')
    .update({ logo_url: `${publicUrl}?v=${Date.now()}` })
    .eq('id', id)
    .select('id, name, name_en, code, logo_url, is_active, created_at')
    .single();

  if (error || !school) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถบันทึกโลโก้ได้' },
      { status: 500 }
    );
  }

  return NextResponse.json({ school });
}
