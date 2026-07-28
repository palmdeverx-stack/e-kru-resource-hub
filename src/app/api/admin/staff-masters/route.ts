import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canViewViaPermission } from 'src/lib/department-permission-access';

// ----------------------------------------------------------------------

const CATEGORIES = [
  'staff_type',
  'prefix',
  'position',
  'academic_rank',
  'employment_status',
] as const;
const CODE_REQUIRED_CATEGORIES: ReadonlyArray<(typeof CATEGORIES)[number]> = [
  'staff_type',
  'employment_status',
];

function isCategory(value: unknown): value is (typeof CATEGORIES)[number] {
  return typeof value === 'string' && CATEGORIES.includes(value as (typeof CATEGORIES)[number]);
}

export async function GET(request: Request) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (
    !caller?.schoolId ||
    (caller.role === 'teacher' && !(await canViewViaPermission(caller, 'staff.manage')))
  ) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('staff_master_items')
    .select(
      'id, category, code, name, name_en, sort_order, is_active, is_system, created_at, updated_at'
    )
    .eq('school_id', caller.schoolId)
    .order('category')
    .order('sort_order')
    .order('name');

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const category = body?.category;
  const name = typeof body?.nameTh === 'string' ? body.nameTh.trim() : '';
  const nameEn = typeof body?.nameEn === 'string' ? body.nameEn.trim() : '';
  const sortOrder = Number.isInteger(body?.sortOrder) ? body.sortOrder : 0;

  if (!isCategory(category) || !name) {
    return NextResponse.json({ message: 'กรุณาระบุหมวดและชื่อรายการ' }, { status: 400 });
  }

  const code = CODE_REQUIRED_CATEGORIES.includes(category)
    ? `custom_${randomUUID().replaceAll('-', '')}`
    : null;
  const { data, error } = await supabaseAdmin
    .from('staff_master_items')
    .insert({
      school_id: caller.schoolId,
      category,
      code,
      name,
      name_en: nameEn || null,
      sort_order: sortOrder,
      is_active: true,
      is_system: false,
    })
    .select(
      'id, category, code, name, name_en, sort_order, is_active, is_system, created_at, updated_at'
    )
    .single();

  if (error || !data) {
    const duplicate = error?.code === '23505';
    return NextResponse.json(
      {
        message: duplicate
          ? 'มีชื่อรายการนี้อยู่แล้ว'
          : (error?.message ?? 'ไม่สามารถเพิ่มรายการได้'),
      },
      { status: duplicate ? 409 : 500 }
    );
  }

  return NextResponse.json({ item: data }, { status: 201 });
}
