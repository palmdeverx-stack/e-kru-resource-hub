import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

import { parsePlanPayload } from './plan-payload';

const PLAN_FIELDS =
  'id, code, name, description, billing_cycle, price, currency, max_school_admins, max_teachers, max_students, max_line_notifications, enabled_features, is_active, sort_order, created_at, updated_at';

export async function GET(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  let query = supabaseAdmin
    .from('subscription_plans')
    .select(PLAN_FIELDS)
    .order('sort_order')
    .order('price');

  if (searchParams.get('includeInactive') !== 'true') {
    query = query.eq('is_active', true);
  }

  const { data: plans, error } = await query;
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ plans: plans ?? [] });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const payload = parsePlanPayload(await request.json().catch(() => null));
  if (!payload) {
    return NextResponse.json({ message: 'ข้อมูลแพ็กเกจไม่ถูกต้อง' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('subscription_plans')
    .select('id')
    .ilike('code', payload.code)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ message: 'รหัสแพ็กเกจนี้ถูกใช้แล้ว' }, { status: 409 });
  }

  const { data: plan, error } = await supabaseAdmin
    .from('subscription_plans')
    .insert(payload)
    .select(PLAN_FIELDS)
    .single();

  if (error || !plan) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถสร้างแพ็กเกจได้' },
      { status: 500 }
    );
  }
  return NextResponse.json({ plan }, { status: 201 });
}
