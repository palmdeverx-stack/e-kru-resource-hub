import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

export async function POST(request: Request) {
  const caller = requireRole(request, ['master_admin', 'school_admin', 'teacher', 'student']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { ids } = (await request.json().catch(() => ({}))) as { ids?: string[] };

  let query = supabaseAdmin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', caller.sub)
    .is('read_at', null);

  if (Array.isArray(ids) && ids.length) {
    query = query.in('id', ids);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
