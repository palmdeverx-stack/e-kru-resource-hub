import 'server-only';

import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

type LookupConfig = {
  table:
    | 'marketplace_media_types'
    | 'marketplace_sale_types'
    | 'marketplace_media_review_rules'
    | 'marketplace_order_finance_types'
    | 'marketplace_report_reasons'
    | 'marketplace_grade_levels'
    | 'marketplace_curricula'
    | 'marketplace_tags';
  behaviorColumn?:
    | 'delivery_mode'
    | 'pricing_mode'
    | 'review_scope'
    | 'finance_scope'
    | 'reason_scope';
  behaviorValues?: string[];
  /** Table checked for in-use rows when updating a behavior or deleting. Defaults to 'marketplace_products'. */
  usageTable?: string;
  productColumn?: 'media_type_id' | 'sale_type_id' | 'grade_level_id' | 'tag_id' | 'curriculum_id';
  label: string;
};

function requireMaster(request: Request) {
  return requireRole(request, ['master_admin']);
}

function inputFrom(body: Record<string, unknown>, config: LookupConfig) {
  const code = String(body.code ?? '')
    .trim()
    .toLowerCase();
  const name = String(body.name ?? '').trim();
  const description = String(body.description ?? '').trim();
  const behavior = String(body.behavior ?? '');
  const sortOrder = Math.max(0, Number(body.sortOrder) || 0);

  if (!/^[a-z0-9_-]{2,40}$/.test(code)) {
    return { error: 'รหัสต้องมี 2–40 ตัว และใช้เฉพาะ a-z, 0-9, - หรือ _' } as const;
  }
  if (name.length < 2 || name.length > 80) {
    return { error: 'ชื่อต้องมี 2–80 ตัวอักษร' } as const;
  }
  if (config.behaviorColumn && !config.behaviorValues?.includes(behavior)) {
    return { error: 'กรุณาเลือกพฤติกรรมให้ถูกต้อง' } as const;
  }

  return {
    value: {
      code,
      name,
      description: description || null,
      ...(config.behaviorColumn ? { [config.behaviorColumn]: behavior } : {}),
      sort_order: sortOrder,
      is_active: body.isActive !== false,
      updated_at: new Date().toISOString(),
    },
  } as const;
}

export async function listLookup(request: Request, config: LookupConfig) {
  const includeInactive = new URL(request.url).searchParams.get('all') === '1';
  if (includeInactive && !requireMaster(request)) {
    return NextResponse.json({ message: `ไม่มีสิทธิ์ดู${config.label}ทั้งหมด` }, { status: 403 });
  }

  let query = supabaseAdmin.from(config.table).select('*').order('sort_order').order('name');
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ items: [], setupRequired: true });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function createLookup(request: Request, config: LookupConfig) {
  if (!requireMaster(request)) {
    return NextResponse.json({ message: `ไม่มีสิทธิ์เพิ่ม${config.label}` }, { status: 403 });
  }

  const input = inputFrom(await request.json(), config);
  if ('error' in input) return NextResponse.json({ message: input.error }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from(config.table)
    .insert(input.value)
    .select('*')
    .single();
  if (error || !data) {
    return NextResponse.json(
      {
        message:
          error?.code === '23505'
            ? `มีรหัสหรือชื่อ${config.label}นี้แล้ว`
            : (error?.message ?? `เพิ่ม${config.label}ไม่สำเร็จ`),
      },
      { status: error?.code === '23505' ? 409 : 500 }
    );
  }
  return NextResponse.json({ item: data }, { status: 201 });
}

export async function updateLookup(
  request: Request,
  id: string,
  config: LookupConfig
) {
  if (!requireMaster(request)) {
    return NextResponse.json({ message: `ไม่มีสิทธิ์แก้ไข${config.label}` }, { status: 403 });
  }

  const input = inputFrom(await request.json(), config);
  if ('error' in input) return NextResponse.json({ message: input.error }, { status: 400 });

  const { data: currentRow } = await supabaseAdmin
    .from(config.table)
    .select(config.behaviorColumn ? `id, ${config.behaviorColumn}` : 'id')
    .eq('id', id)
    .maybeSingle();
  const current = currentRow as Record<string, unknown> | null;
  if (!current) {
    return NextResponse.json({ message: `ไม่พบ${config.label}` }, { status: 404 });
  }

  const nextValue = input.value as Record<string, unknown>;
  if (
    config.behaviorColumn &&
    config.productColumn &&
    current[config.behaviorColumn] !== nextValue[config.behaviorColumn]
  ) {
    const { count, error: countError } = await supabaseAdmin
      .from(config.usageTable ?? 'marketplace_products')
      .select('*', { count: 'exact', head: true })
      .eq(config.productColumn, id);
    if (countError) return NextResponse.json({ message: countError.message }, { status: 500 });
    if (count) {
      return NextResponse.json(
        {
          message: `เปลี่ยนพฤติกรรมไม่ได้ เนื่องจากมีสินค้า ${count} รายการใช้${config.label}นี้`,
        },
        { status: 409 }
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from(config.table)
    .update(input.value)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      {
        message:
          error?.code === '23505'
            ? `มีรหัสหรือชื่อ${config.label}นี้แล้ว`
            : (error?.message ?? `ไม่พบ${config.label}`),
      },
      { status: error?.code === '23505' ? 409 : 404 }
    );
  }
  return NextResponse.json({ item: data });
}

export async function deleteLookup(request: Request, id: string, config: LookupConfig) {
  if (!requireMaster(request)) {
    return NextResponse.json({ message: `ไม่มีสิทธิ์ลบ${config.label}` }, { status: 403 });
  }

  if (config.productColumn) {
    const { count, error: countError } = await supabaseAdmin
      .from(config.usageTable ?? 'marketplace_products')
      .select('*', { count: 'exact', head: true })
      .eq(config.productColumn, id);
    if (countError) return NextResponse.json({ message: countError.message }, { status: 500 });
    if (count) {
      return NextResponse.json(
        { message: `ลบไม่ได้ เนื่องจากมีสินค้า ${count} รายการใช้${config.label}นี้` },
        { status: 409 }
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from(config.table)
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? `ไม่พบ${config.label}` },
      { status: error ? 500 : 404 }
    );
  }
  return NextResponse.json({ success: true });
}

export const mediaTypeConfig: LookupConfig = {
  table: 'marketplace_media_types',
  behaviorColumn: 'delivery_mode',
  behaviorValues: ['digital', 'physical', 'service'],
  productColumn: 'media_type_id',
  label: 'ประเภทสื่อ',
};

export const saleTypeConfig: LookupConfig = {
  table: 'marketplace_sale_types',
  behaviorColumn: 'pricing_mode',
  behaviorValues: ['free', 'paid'],
  productColumn: 'sale_type_id',
  label: 'ประเภทการจำหน่าย',
};

export const mediaReviewRuleConfig: LookupConfig = {
  table: 'marketplace_media_review_rules',
  behaviorColumn: 'review_scope',
  behaviorValues: ['content', 'file', 'rights'],
  label: 'เกณฑ์ตรวจสอบสื่อ',
};

export const orderFinanceTypeConfig: LookupConfig = {
  table: 'marketplace_order_finance_types',
  behaviorColumn: 'finance_scope',
  behaviorValues: ['order', 'payment', 'finance'],
  label: 'รายการคำสั่งซื้อและการเงิน',
};

export const reportReasonConfig: LookupConfig = {
  table: 'marketplace_report_reasons',
  behaviorColumn: 'reason_scope',
  behaviorValues: ['product', 'review', 'seller'],
  label: 'เหตุผลการรายงาน',
};

export const gradeLevelConfig: LookupConfig = {
  table: 'marketplace_grade_levels',
  usageTable: 'marketplace_product_grade_levels',
  productColumn: 'grade_level_id',
  label: 'ระดับชั้น',
};

export const curriculumConfig: LookupConfig = {
  table: 'marketplace_curricula',
  productColumn: 'curriculum_id',
  label: 'หลักสูตร',
};

export const tagConfig: LookupConfig = {
  table: 'marketplace_tags',
  usageTable: 'marketplace_product_tags',
  productColumn: 'tag_id',
  label: 'แท็ก',
};
