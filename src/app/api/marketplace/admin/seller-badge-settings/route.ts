import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { writeSecurityAudit } from 'src/lib/security-audit';

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

function authorize(request: Request) {
  return requireRole(request, ['super_admin']);
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ message: 'เฉพาะ Super Admin ที่ตั้งค่ารางวัลผู้ขายได้' }, { status: 403 });
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
  const caller = authorize(request);
  if (!caller) {
    return NextResponse.json({ message: 'เฉพาะ Super Admin ที่ตั้งค่ารางวัลผู้ขายได้' }, { status: 403 });
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

  const rows: Array<Record<string, unknown>> = [];
  for (const item of items) {
    const badgeKey = String(item?.badge_key ?? '') as (typeof BADGE_KEYS)[number];
    const evaluationDays = Number(item?.evaluation_days);
    const criteria = item?.criteria;
    if (
      !BADGE_KEYS.includes(badgeKey) ||
      typeof item?.is_enabled !== 'boolean' ||
      !Number.isInteger(evaluationDays) ||
      evaluationDays < 1 ||
      evaluationDays > 3650 ||
      !criteria ||
      typeof criteria !== 'object' ||
      Array.isArray(criteria)
    ) {
      return NextResponse.json({ message: `ข้อมูล ${badgeKey || 'Badge'} ไม่ถูกต้อง` }, { status: 400 });
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
        return NextResponse.json({ message: `เกณฑ์ ${key} ของ ${badgeKey} ไม่ถูกต้อง` }, { status: 400 });
      }
      normalizedCriteria[key] = value;
    }

    rows.push({
      badge_key: badgeKey,
      is_enabled: item.is_enabled,
      evaluation_days: evaluationDays,
      criteria: normalizedCriteria,
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
  return NextResponse.json({ success: true });
}
