import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { writeSecurityAudit } from 'src/lib/security-audit';

const ALLOWED_RESULTS = ['success', 'failure', 'denied'];
const ALLOWED_CATEGORIES = ['authentication', 'authorization', 'account', 'download', 'admin'];

export async function GET(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    await writeSecurityAudit({
      request,
      category: 'authorization',
      action: 'security_audit.read',
      result: 'denied',
    });
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดูบันทึกความปลอดภัย' }, { status: 403 });
  }

  const url = new URL(request.url);
  const page = Math.max(0, Number.parseInt(url.searchParams.get('page') ?? '0', 10) || 0);
  const pageSize = Math.min(
    100,
    Math.max(10, Number.parseInt(url.searchParams.get('pageSize') ?? '20', 10) || 20)
  );
  const category = url.searchParams.get('category') ?? '';
  const result = url.searchParams.get('result') ?? '';

  if (category && !ALLOWED_CATEGORIES.includes(category)) {
    return NextResponse.json({ message: 'ประเภทเหตุการณ์ไม่ถูกต้อง' }, { status: 400 });
  }
  if (result && !ALLOWED_RESULTS.includes(result)) {
    return NextResponse.json({ message: 'ผลลัพธ์ไม่ถูกต้อง' }, { status: 400 });
  }

  let query = supabaseAdmin
    .from('security_audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (category) query = query.eq('category', category);
  if (result) query = query.eq('result', result);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'authorization',
    action: 'security_audit.read',
    targetType: 'security_audit_log',
    result: 'success',
    metadata: { page, pageSize, category: category || null, result: result || null },
  });

  return NextResponse.json({ items: data ?? [], total: count ?? 0, page, pageSize });
}

