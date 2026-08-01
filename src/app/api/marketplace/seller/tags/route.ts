import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { cleanupUnusedSellerTags } from 'src/sections/marketplace/seller/server/seller-tags';

const MAX_CUSTOM_TAGS_PER_SELLER = 30;

function normalizeTagName(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  await cleanupUnusedSellerTags();

  const { data, error } = await supabaseAdmin
    .from('marketplace_tags')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({
    items: (data ?? []).map((tag) => ({
      ...tag,
      can_delete: tag.created_by === caller.sub && !tag.first_used_at,
    })),
  });
}

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const { data: seller } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, status')
    .eq('owner_id', caller.sub)
    .maybeSingle();
  if (!seller || seller.status !== 'active') {
    return NextResponse.json(
      { message: 'เฉพาะร้านค้าที่อนุมัติแล้วเท่านั้นที่เพิ่มแท็กได้' },
      { status: 403 }
    );
  }

  const name = normalizeTagName((await request.json()).name);
  if (name.length < 2 || name.length > 40) {
    return NextResponse.json({ message: 'ชื่อแท็กต้องมี 2–40 ตัวอักษร' }, { status: 400 });
  }

  await cleanupUnusedSellerTags();
  const { data: activeTags, error: activeTagsError } = await supabaseAdmin
    .from('marketplace_tags')
    .select('*')
    .eq('is_active', true);
  if (activeTagsError) {
    return NextResponse.json({ message: activeTagsError.message }, { status: 500 });
  }
  const existing = (activeTags ?? []).find(
    (tag) => tag.name.trim().toLocaleLowerCase('th-TH') === name.toLocaleLowerCase('th-TH')
  );
  if (existing) {
    return NextResponse.json({
      item: {
        ...existing,
        can_delete: existing.created_by === caller.sub && !existing.first_used_at,
      },
      reused: true,
    });
  }

  const { count, error: countError } = await supabaseAdmin
    .from('marketplace_tags')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', caller.sub);
  if (countError) return NextResponse.json({ message: countError.message }, { status: 500 });
  if ((count ?? 0) >= MAX_CUSTOM_TAGS_PER_SELLER) {
    return NextResponse.json(
      { message: `เพิ่มแท็กส่วนตัวได้ไม่เกิน ${MAX_CUSTOM_TAGS_PER_SELLER} รายการ` },
      { status: 409 }
    );
  }

  const code = `seller-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('marketplace_tags')
    .insert({
      code,
      name,
      created_by: caller.sub,
      expires_at: expiresAt,
      sort_order: 999,
      is_active: true,
    })
    .select('*')
    .single();
  if (error || !data) {
    return NextResponse.json(
      {
        message:
          error?.code === '23505'
            ? 'มีชื่อแท็กนี้ในระบบแล้ว กรุณาเลือกจากรายการเดิมหรือติดต่อผู้ดูแล'
            : (error?.message ?? 'เพิ่มแท็กไม่สำเร็จ'),
      },
      { status: error?.code === '23505' ? 409 : 500 }
    );
  }

  return NextResponse.json({ item: { ...data, can_delete: true }, reused: false }, { status: 201 });
}
