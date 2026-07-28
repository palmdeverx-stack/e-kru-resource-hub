import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

function canAccessSchool(
  caller: { role: string; schoolId: string | null },
  schoolId: string
): boolean {
  return caller.role === 'master_admin' || caller.schoolId === schoolId;
}

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['master_admin', 'school_admin', 'teacher', 'student']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;

  if (!canAccessSchool(caller, id)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { data: school, error } = await supabaseAdmin
    .from('schools')
    .select('id, name, name_en, code, logo_url, is_active, created_at')
    .eq('id', id)
    .single();

  if (error || !school) {
    return NextResponse.json({ message: 'ไม่พบโรงเรียนนี้' }, { status: 404 });
  }

  return NextResponse.json({ school });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['master_admin', 'school_admin']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;

  if (!canAccessSchool(caller, id)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { name, nameEn, code, isActive } = await request.json();

  const updates: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ message: 'กรุณากรอกชื่อโรงเรียน' }, { status: 400 });
    }
    updates.name = name.trim();
  }

  if (nameEn !== undefined) {
    if (typeof nameEn !== 'string') {
      return NextResponse.json({ message: 'ชื่อโรงเรียนภาษาอังกฤษไม่ถูกต้อง' }, { status: 400 });
    }
    updates.name_en = nameEn.trim() || null;
  }

  if (code !== undefined) {
    if (caller.role !== 'master_admin') {
      return NextResponse.json(
        { message: 'เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขรหัสโรงเรียนได้' },
        { status: 403 }
      );
    }
    if (typeof code !== 'string' || !code.trim()) {
      return NextResponse.json({ message: 'กรุณากรอกรหัสโรงเรียน' }, { status: 400 });
    }
    if (!/^\d{8}$/.test(code.trim())) {
      return NextResponse.json(
        { message: 'รหัสโรงเรียนต้องเป็นตัวเลข 8 หลัก' },
        { status: 400 }
      );
    }

    const { data: duplicate } = await supabaseAdmin
      .from('schools')
      .select('id')
      .ilike('code', code.trim())
      .neq('id', id)
      .maybeSingle();

    if (duplicate) {
      return NextResponse.json({ message: 'รหัสโรงเรียนนี้ถูกใช้แล้ว' }, { status: 409 });
    }
    updates.code = code.trim();
  }

  if (isActive !== undefined) {
    if (caller.role !== 'master_admin') {
      return NextResponse.json(
        { message: 'เฉพาะผู้ดูแลระบบเท่านั้นที่เปิด/ปิดการใช้งานโรงเรียนได้' },
        { status: 403 }
      );
    }
    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { message: 'ค่า isActive ต้องเป็น true หรือ false' },
        { status: 400 }
      );
    }
    updates.is_active = isActive;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: 'ไม่มีข้อมูลให้อัปเดต' }, { status: 400 });
  }

  const { data: school, error } = await supabaseAdmin
    .from('schools')
    .update(updates)
    .eq('id', id)
    .select('id, name, name_en, code, logo_url, is_active, created_at')
    .single();

  if (error || !school) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถอัปเดตข้อมูลโรงเรียนได้' },
      { status: 500 }
    );
  }

  return NextResponse.json({ school });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('id, name')
    .eq('id', id)
    .maybeSingle();

  if (!school) {
    return NextResponse.json({ message: 'ไม่พบโรงเรียนนี้' }, { status: 404 });
  }

  const [users, academicYears, classrooms, subjects] = await Promise.all([
    supabaseAdmin
      .from('app_users')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', id),
    supabaseAdmin
      .from('academic_years')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', id),
    supabaseAdmin
      .from('classrooms')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', id),
    supabaseAdmin.from('subjects').select('id', { count: 'exact', head: true }).eq('school_id', id),
  ]);
  const relatedCount =
    (users.count ?? 0) +
    (academicYears.count ?? 0) +
    (classrooms.count ?? 0) +
    (subjects.count ?? 0);

  if (relatedCount > 0) {
    return NextResponse.json(
      {
        message: 'โรงเรียนนี้มีผู้ใช้งานหรือข้อมูลการเรียนอยู่ ไม่สามารถลบได้ กรุณาปิดการใช้งานแทน',
      },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin.from('schools').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const { data: logoFiles } = await supabaseAdmin.storage.from('school-logos').list(id);
  if (logoFiles?.length) {
    await supabaseAdmin.storage
      .from('school-logos')
      .remove(logoFiles.map((file) => `${id}/${file.name}`));
  }

  return NextResponse.json({ success: true });
}
