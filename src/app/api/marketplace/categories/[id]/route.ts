import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Context) {
  if (!requireRole(request, ['master_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์แก้ไขหมวดหมู่' }, { status: 403 });
  }

  const { id } = await params;
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

  const { data: currentCategory } = await supabaseAdmin
    .from('marketplace_categories')
    .select('name')
    .eq('id', id)
    .maybeSingle();
  if (!currentCategory) {
    return NextResponse.json({ message: 'ไม่พบหมวดหมู่' }, { status: 404 });
  }

  const { data: category, error } = await supabaseAdmin
    .from('marketplace_categories')
    .update({
      name,
      description: description || null,
      sort_order: sortOrder,
      is_active: body.isActive !== false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error || !category) {
    return NextResponse.json(
      {
        message:
          error?.code === '23505'
            ? 'มีชื่อหมวดหมู่นี้แล้ว'
            : (error?.message ?? 'ไม่พบหมวดหมู่'),
      },
      { status: error?.code === '23505' ? 409 : 404 }
    );
  }

  if (currentCategory.name !== category.name) {
    const { error: productUpdateError } = await supabaseAdmin
      .from('marketplace_products')
      .update({ category: category.name, updated_at: new Date().toISOString() })
      .eq('category', currentCategory.name);
    if (productUpdateError) {
      await supabaseAdmin
        .from('marketplace_categories')
        .update({ name: currentCategory.name, updated_at: new Date().toISOString() })
        .eq('id', id);
      return NextResponse.json(
        { message: `เปลี่ยนชื่อหมวดหมู่ไม่สำเร็จ: ${productUpdateError.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ category });
}

export async function DELETE(request: Request, { params }: Context) {
  if (!requireRole(request, ['master_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ลบหมวดหมู่' }, { status: 403 });
  }

  const { id } = await params;
  const { data: category } = await supabaseAdmin
    .from('marketplace_categories')
    .select('name')
    .eq('id', id)
    .maybeSingle();
  if (!category) {
    return NextResponse.json({ message: 'ไม่พบหมวดหมู่' }, { status: 404 });
  }

  const { count: productCount, error: countError } = await supabaseAdmin
    .from('marketplace_products')
    .select('*', { count: 'exact', head: true })
    .eq('category', category.name);
  if (countError) {
    return NextResponse.json({ message: countError.message }, { status: 500 });
  }
  if (productCount) {
    return NextResponse.json(
      { message: `ลบไม่ได้ เนื่องจากมีสินค้า ${productCount} รายการอยู่ในหมวดหมู่นี้` },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin.from('marketplace_categories').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
