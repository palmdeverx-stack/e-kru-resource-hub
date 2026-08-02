import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { writeSecurityAudit } from 'src/lib/security-audit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

const BADGE_KEYS = [
  'top_seller',
  'highly_rated',
  'best_seller',
  'rising_creator',
  'customer_favorite',
  'new_creator',
] as const;

const CRITERIA_KEYS: Record<(typeof BADGE_KEYS)[number], string[]> = {
  top_seller: ['min_orders', 'min_gross_sales', 'min_average_rating', 'min_review_count'],
  highly_rated: ['min_average_rating', 'min_review_count'],
  best_seller: ['top_product_limit', 'min_best_seller_products', 'min_units_sold'],
  rising_creator: ['max_seller_age_days', 'min_growth_percent', 'min_orders'],
  customer_favorite: ['min_repeat_buyer_rate', 'min_orders'],
  new_creator: ['max_seller_age_days'],
};

const INTEGER_CRITERIA = new Set([
  'min_orders',
  'min_review_count',
  'top_product_limit',
  'min_best_seller_products',
  'min_units_sold',
  'max_seller_age_days',
]);
const BADGE_ICON_KEYS = new Set([
  'trophy',
  'star',
  'fire',
  'rocket',
  'heart',
  'sparkling',
  'award',
]);
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function authorize(request: Request) {
  return requireRole(request, ['master_admin', 'marketplace_admin']);
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json(
      { message: 'เฉพาะผู้ดูแล Marketplace ที่ตั้งค่ารางวัลผู้ขายได้' },
      { status: 403 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('marketplace_seller_badge_settings')
    .select('*')
    .order('priority');
  if (error) {
    return NextResponse.json(
      { message: error.message, settings: [], setupRequired: error.code === '42P01' },
      { status: error.code === '42P01' ? 200 : 500 }
    );
  }
  return NextResponse.json({ settings: data ?? [], setupRequired: false });
}

export async function PATCH(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = authorize(request);
  if (!caller) {
    return NextResponse.json(
      { message: 'เฉพาะผู้ดูแล Marketplace ที่ตั้งค่ารางวัลผู้ขายได้' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const items = Array.isArray(body?.settings) ? body.settings : [];
  if (items.length !== BADGE_KEYS.length) {
    return NextResponse.json({ message: 'ข้อมูลรางวัลไม่ครบถ้วน' }, { status: 400 });
  }
  const submittedBadgeKeys = items.map((item: { badge_key?: unknown }) =>
    String(item?.badge_key ?? '')
  );
  if (new Set(submittedBadgeKeys).size !== BADGE_KEYS.length) {
    return NextResponse.json({ message: 'มีรางวัลซ้ำกันหรือขาดหาย' }, { status: 400 });
  }
  const submittedPriorities = items.map((item: { priority?: unknown }) => Number(item.priority));
  if (new Set(submittedPriorities).size !== BADGE_KEYS.length) {
    return NextResponse.json({ message: 'ลำดับแสดงผลของรางวัลต้องไม่ซ้ำกัน' }, { status: 400 });
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const item of items) {
    const badgeKey = String(item?.badge_key ?? '') as (typeof BADGE_KEYS)[number];
    const evaluationDays = Number(item?.evaluation_days);
    const labelTh = String(item?.label_th ?? '').trim();
    const labelEn = String(item?.label_en ?? '').trim();
    const descriptionTh = String(item?.description_th ?? '').trim();
    const descriptionEn = String(item?.description_en ?? '').trim();
    const iconKey = String(item?.icon_key ?? '');
    const color = String(item?.color ?? '').toUpperCase();
    const priority = Number(item?.priority);
    const criteria = item?.criteria;
    if (
      !BADGE_KEYS.includes(badgeKey) ||
      typeof item?.is_enabled !== 'boolean' ||
      !labelTh ||
      labelTh.length > 60 ||
      !labelEn ||
      labelEn.length > 60 ||
      !descriptionTh ||
      descriptionTh.length > 240 ||
      !descriptionEn ||
      descriptionEn.length > 240 ||
      !BADGE_ICON_KEYS.has(iconKey) ||
      !HEX_COLOR_PATTERN.test(color) ||
      !Number.isInteger(priority) ||
      priority < 0 ||
      priority > 10_000 ||
      !Number.isInteger(evaluationDays) ||
      evaluationDays < 1 ||
      evaluationDays > 3650 ||
      !criteria ||
      typeof criteria !== 'object' ||
      Array.isArray(criteria)
    ) {
      return NextResponse.json(
        { message: `ข้อมูล ${badgeKey || 'Badge'} ไม่ถูกต้อง` },
        { status: 400 }
      );
    }

    const allowedCriteria = CRITERIA_KEYS[badgeKey];
    const normalizedCriteria: Record<string, number> = {};
    for (const key of allowedCriteria) {
      const value = Number(criteria[key]);
      const maximum = key === 'min_average_rating' ? 5 : key.includes('percent') ? 100 : 1_000_000;
      if (
        !Number.isFinite(value) ||
        value < 0 ||
        value > maximum ||
        (INTEGER_CRITERIA.has(key) && !Number.isInteger(value))
      ) {
        return NextResponse.json(
          { message: `เกณฑ์ ${key} ของ ${badgeKey} ไม่ถูกต้อง` },
          { status: 400 }
        );
      }
      normalizedCriteria[key] = value;
    }

    rows.push({
      badge_key: badgeKey,
      label_th: labelTh,
      label_en: labelEn,
      description_th: descriptionTh,
      description_en: descriptionEn,
      icon_key: iconKey,
      color,
      is_enabled: item.is_enabled,
      evaluation_days: evaluationDays,
      criteria: normalizedCriteria,
      priority,
      updated_by: caller.sub,
      updated_at: new Date().toISOString(),
    });
  }

  const { error } = await supabaseAdmin
    .from('marketplace_seller_badge_settings')
    .upsert(rows, { onConflict: 'badge_key' });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'admin',
    action: 'marketplace.seller_badge_settings_update',
    targetType: 'seller_badge_settings',
    targetId: 'all',
    result: 'success',
    metadata: { settings: rows },
  });
  return NextResponse.json({
    success: true,
    settings: rows.toSorted((a, b) => Number(a.priority) - Number(b.priority)),
  });
}
