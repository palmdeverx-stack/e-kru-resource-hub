import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

const BUCKET = 'profile-avatars';
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE = Math.round(1.5 * 1024 * 1024);

async function removeStoredAvatar(teacherId: string) {
  const { data: files, error } = await supabaseAdmin.storage.from(BUCKET).list(teacherId);
  if (error || !files?.length) return error;

  const { error: removeError } = await supabaseAdmin.storage
    .from(BUCKET)
    .remove(files.map((file) => `${teacherId}/${file.name}`));

  return removeError;
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['teacher']);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ message: 'กรุณาเลือกไฟล์รูปภาพ' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ message: 'รองรับเฉพาะไฟล์ PNG, JPEG หรือ WEBP' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ message: 'ไฟล์หลังย่อต้องมีขนาดไม่เกิน 1.5MB' }, { status: 400 });
  }

  const removeError = await removeStoredAvatar(caller.sub);
  if (removeError) return NextResponse.json({ message: removeError.message }, { status: 500 });

  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const path = `${caller.sub}/avatar.${extension}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return NextResponse.json({ message: uploadError.message }, { status: 500 });

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const avatarUrl = `${publicUrl}?v=${Date.now()}`;

  const { error } = await supabaseAdmin
    .from('app_users')
    .update({ avatar_url: avatarUrl })
    .eq('id', caller.sub)
    .eq('role', 'teacher');

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ avatarUrl });
}

export async function DELETE(request: Request) {
  const caller = requireRole(request, ['teacher']);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const removeError = await removeStoredAvatar(caller.sub);
  if (removeError) return NextResponse.json({ message: removeError.message }, { status: 500 });

  const { error } = await supabaseAdmin
    .from('app_users')
    .update({ avatar_url: null })
    .eq('id', caller.sub)
    .eq('role', 'teacher');

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ avatarUrl: null });
}
