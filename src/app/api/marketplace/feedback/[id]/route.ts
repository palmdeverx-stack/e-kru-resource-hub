import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { writeSecurityAudit } from 'src/lib/security-audit';

const STATUSES = new Set(['new', 'reviewing', 'planned', 'resolved', 'closed']);
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการ Feedback' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const status = String(body?.status ?? '');
  const adminNote = String(body?.adminNote ?? '').trim();
  if (!STATUSES.has(status) || adminNote.length > 2000) {
    return NextResponse.json({ message: 'สถานะหรือหมายเหตุไม่ถูกต้อง' }, { status: 400 });
  }

  const { id } = await params;
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('marketplace_feedback')
    .update({
      status,
      admin_note: adminNote || null,
      reviewed_by: caller.sub,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบ Feedback' },
      { status: error ? 500 : 404 }
    );
  }

  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'admin',
    action: 'marketplace.feedback_status_update',
    targetType: 'marketplace_feedback',
    targetId: id,
    result: 'success',
    metadata: { status, has_admin_note: Boolean(adminNote) },
  });

  return NextResponse.json({ feedback: data });
}
