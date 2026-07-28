import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

import { parsePlanPayload } from '../plan-payload';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };
const PLAN_FIELDS =
  'id, code, name, description, billing_cycle, price, currency, max_school_admins, max_teachers, max_students, max_line_notifications, enabled_features, is_active, sort_order, created_at, updated_at';

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const payload = parsePlanPayload(await request.json().catch(() => null));
  if (!payload) {
    return NextResponse.json({ message: 'ข้อมูลแพ็กเกจไม่ถูกต้อง' }, { status: 400 });
  }

  const { data: duplicate } = await supabaseAdmin
    .from('subscription_plans')
    .select('id')
    .ilike('code', payload.code)
    .neq('id', id)
    .maybeSingle();
  if (duplicate) {
    return NextResponse.json({ message: 'รหัสแพ็กเกจนี้ถูกใช้แล้ว' }, { status: 409 });
  }

  const { data: plan, error } = await supabaseAdmin
    .from('subscription_plans')
    .update(payload)
    .eq('id', id)
    .select(PLAN_FIELDS)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  if (!plan) {
    return NextResponse.json({ message: 'ไม่พบแพ็กเกจนี้' }, { status: 404 });
  }
  return NextResponse.json({ plan });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { data: plan, error } = await supabaseAdmin
    .from('subscription_plans')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  if (!plan) {
    return NextResponse.json({ message: 'ไม่พบแพ็กเกจนี้' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
