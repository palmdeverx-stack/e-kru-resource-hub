import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

const BUCKET = 'subject-images';
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

async function getOwnedSubject(id: string, schoolId: string | null) {
  return supabaseAdmin
    .from('subjects')
    .select('id')
    .eq('id', id)
    .eq('school_id', schoolId)
    .maybeSingle();
}

async function removeStoredImages(folder: string) {
  const { data: files, error } = await supabaseAdmin.storage.from(BUCKET).list(folder);
  if (error) return error;
  if (!files?.length) return null;

  const { error: removeError } = await supabaseAdmin.storage
    .from(BUCKET)
    .remove(files.map((file) => `${folder}/${file.name}`));

  return removeError;
}

export async function POST(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { data: subject } = await getOwnedSubject(id, caller.schoolId);
  if (!subject) return NextResponse.json({ message: 'ไม่พบรายวิชานี้' }, { status: 404 });

  if (caller.role === 'teacher') {
    const { data: assignment } = await supabaseAdmin
      .from('teacher_assignments')
      .select('id')
      .eq('teacher_id', caller.sub)
      .eq('subject_id', id)
      .limit(1)
      .maybeSingle();
    if (!assignment) {
      return NextResponse.json({ message: 'แก้ไขได้เฉพาะรูปของวิชาที่คุณสอน' }, { status: 403 });
    }
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
    return NextResponse.json({ message: 'ไฟล์ต้องมีขนาดไม่เกิน 5MB' }, { status: 400 });
  }

  const folder = `${caller.schoolId}/${id}`;
  const removeError = await removeStoredImages(folder);
  if (removeError) return NextResponse.json({ message: removeError.message }, { status: 500 });

  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const path = `${folder}/cover.${extension}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return NextResponse.json({ message: uploadError.message }, { status: 500 });

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

  const { data, error } = await supabaseAdmin
    .from('subjects')
    .update({ image_url: `${publicUrl}?v=${Date.now()}` })
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .select(
      'id, code, name, name_en, credits, description, description_en, image_url, academic_year_id, semester_id, created_at'
    )
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ subject: data });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { data: subject } = await getOwnedSubject(id, caller.schoolId);
  if (!subject) return NextResponse.json({ message: 'ไม่พบรายวิชานี้' }, { status: 404 });

  if (caller.role === 'teacher') {
    const { data: assignment } = await supabaseAdmin
      .from('teacher_assignments')
      .select('id')
      .eq('teacher_id', caller.sub)
      .eq('subject_id', id)
      .limit(1)
      .maybeSingle();
    if (!assignment) {
      return NextResponse.json({ message: 'แก้ไขได้เฉพาะรูปของวิชาที่คุณสอน' }, { status: 403 });
    }
  }

  const removeError = await removeStoredImages(`${caller.schoolId}/${id}`);
  if (removeError) return NextResponse.json({ message: removeError.message }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from('subjects')
    .update({ image_url: null })
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .select(
      'id, code, name, name_en, credits, description, description_en, image_url, academic_year_id, semester_id, created_at'
    )
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ subject: data });
}
