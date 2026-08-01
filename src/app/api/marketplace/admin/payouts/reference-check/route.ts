import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireRole, hasPayoutAccess } from 'src/lib/auth-token';

export async function GET(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตรวจเลขอ้างอิง' }, { status: 403 });
  }
  if (!hasPayoutAccess(request, caller.sub)) {
    return NextResponse.json({ message: 'กรุณายืนยัน PIN อีกครั้ง' }, { status: 401 });
  }

  const url = new URL(request.url);
  const reference = url.searchParams.get('reference')?.trim().toUpperCase() ?? '';
  const excludeId = url.searchParams.get('excludeId')?.trim() ?? '';
  if (reference.length < 4 || reference.length > 100) {
    return NextResponse.json({ message: 'เลขอ้างอิงต้องมี 4–100 ตัวอักษร' }, { status: 400 });
  }

  let query = supabaseAdmin
    .from('marketplace_payouts')
    .select('id')
    .ilike('transfer_reference', reference)
    .limit(1);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query.maybeSingle();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json(
    { available: !data },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
