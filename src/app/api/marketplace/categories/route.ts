import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

export async function GET(request: Request) {
  const includeInactive = new URL(request.url).searchParams.get('all') === '1';
  if (includeInactive && !requireRole(request, ['master_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดูหมวดหมู่ทั้งหมด' }, { status: 403 });
  }

  let query = supabaseAdmin
    .from('marketplace_categories')
    .select('*')
    .order('sort_order')
    .order('name');
  if (!includeInactive) query = query.eq('is_active', true);

  const { data: categories, error } = await query;
  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ categories: [], setupRequired: true });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ categories: categories ?? [] });
}

export async function POST(request: Request) {
  if (!requireRole(request, ['master_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เพิ่มหมวดหมู่' }, { status: 403 });
  }

  const body = await request.json();
  const name = String(body.name ?? '').trim();
  const description = String(body.description ?? '').trim();
  const sortOrder = Math.max(0, Number(body.sortOrder) || 0);

  if (name.length < 2 || name.length > 80) {
    return NextResponse.json(
      { message: 'ชื่อหมวดหมู่ต้องมี 2–80 ตัวอักษร' },
      { status: 400 }
    );
  }

  const { data: category, error } = await supabaseAdmin
    .from('marketplace_categories')
    .insert({
      name,
      description: description || null,
      sort_order: sortOrder,
      is_active: body.isActive !== false,
    })
    .select('*')
    .single();

  if (error || !category) {
    return NextResponse.json(
      {
        message:
          error?.code === '23505'
            ? 'มีชื่อหมวดหมู่นี้แล้ว'
            : (error?.message ?? 'ไม่สามารถเพิ่มหมวดหมู่ได้'),
      },
      { status: error?.code === '23505' ? 409 : 500 }
    );
  }

  return NextResponse.json({ category }, { status: 201 });
}
