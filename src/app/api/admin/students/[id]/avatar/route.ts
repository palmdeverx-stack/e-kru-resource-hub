import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { schoolHasFeature } from 'src/lib/school-subscription';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

const BUCKET = 'profile-avatars';
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE = Math.round(1.5 * 1024 * 1024);

async function getOwnedStudent(id: string, schoolId: string) {
  return supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('id', id)
    .eq('school_id', schoolId)
    .eq('role', 'student')
    .maybeSingle();
}

async function removeStoredAvatar(studentId: string) {
  const { data: files, error } = await supabaseAdmin.storage.from(BUCKET).list(studentId);
  if (error || !files?.length) return error;

  const { error: removeError } = await supabaseAdmin.storage
    .from(BUCKET)
    .remove(files.map((file) => `${studentId}/${file.name}`));
  return removeError;
}

async function canManageStudentAvatar(role: string, schoolId: string) {
  if (role === 'school_admin') return schoolHasFeature(schoolId, 'admin.students');
  if (role === 'teacher') return schoolHasFeature(schoolId, 'teacher.manage_enrollments');
  return false;
}

export async function POST(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller?.schoolId || !(await canManageStudentAvatar(caller.role, caller.schoolId))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { data: student } = await getOwnedStudent(id, caller.schoolId);
  if (!student) {
    return NextResponse.json({ message: 'ไม่พบนักเรียนในโรงเรียนของคุณ' }, { status: 404 });
  }

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

  const removeError = await removeStoredAvatar(id);
  if (removeError) return NextResponse.json({ message: removeError.message }, { status: 500 });

  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const path = `${id}/avatar.${extension}`;
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
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .eq('role', 'student');
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ avatarUrl });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller?.schoolId || !(await canManageStudentAvatar(caller.role, caller.schoolId))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { data: student } = await getOwnedStudent(id, caller.schoolId);
  if (!student) {
    return NextResponse.json({ message: 'ไม่พบนักเรียนในโรงเรียนของคุณ' }, { status: 404 });
  }

  const removeError = await removeStoredAvatar(id);
  if (removeError) return NextResponse.json({ message: removeError.message }, { status: 500 });

  const { error } = await supabaseAdmin
    .from('app_users')
    .update({ avatar_url: null })
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .eq('role', 'student');
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ avatarUrl: null });
}
