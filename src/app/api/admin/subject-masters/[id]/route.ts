import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

const ITEM_SELECT =
  'id, category, code, name, name_en, sort_order, is_active, is_system, created_at, updated_at';

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.nameTh === 'string' ? body.nameTh.trim() : '';
  const nameEn = typeof body?.nameEn === 'string' ? body.nameEn.trim() : '';
  const isActive = body?.isActive;
  const sortOrder = body?.sortOrder;

  if (!name || typeof isActive !== 'boolean' || !Number.isInteger(sortOrder)) {
    return NextResponse.json({ message: 'ข้อมูลรายการไม่ถูกต้อง' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('subject_master_items')
    .update({ name, name_en: nameEn || null, is_active: isActive, sort_order: sortOrder })
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .select(ITEM_SELECT)
    .maybeSingle();

  if (error) {
    const duplicate = error.code === '23505';
    return NextResponse.json(
      { message: duplicate ? 'มีชื่อรายการนี้อยู่แล้ว' : error.message },
      { status: duplicate ? 409 : 500 }
    );
  }
  if (!data) {
    return NextResponse.json({ message: 'ไม่พบรายการ' }, { status: 404 });
  }

  return NextResponse.json({ item: data });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { data: item } = await supabaseAdmin
    .from('subject_master_items')
    .select('id, category, code, is_system')
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .maybeSingle();

  if (!item) {
    return NextResponse.json({ message: 'ไม่พบรายการ' }, { status: 404 });
  }
  if (item.is_system) {
    return NextResponse.json(
      { message: 'รายการมาตรฐานของระบบลบไม่ได้ กรุณาปิดใช้งานแทน' },
      { status: 409 }
    );
  }

  const usedColumn =
    item.category === 'learning_area'
      ? 'learning_area'
      : item.category === 'education_stage'
        ? 'education_stage'
        : 'subject_type';
  const { count } = await supabaseAdmin
    .from('subjects')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', caller.schoolId)
    .eq(usedColumn, item.code);

  if (count) {
    return NextResponse.json(
      { message: `รายการนี้มีรายวิชาใช้งานอยู่ ${count} วิชา กรุณาปิดใช้งานแทน` },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin
    .from('subject_master_items')
    .delete()
    .eq('id', id)
    .eq('school_id', caller.schoolId);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
