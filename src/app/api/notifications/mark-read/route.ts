import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { filterPersonalNotifications } from '../scope';

// ----------------------------------------------------------------------

export async function POST(request: Request) {
  const crossSiteError = rejectCrossSiteMutation(request);
  if (crossSiteError) return crossSiteError;

  const caller = requireRole(request, [
    'master_admin',
    'marketplace_admin',
    'school_admin',
    'teacher',
    'student',
    'marketplace_user',
  ]);

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

  const { error } = await filterPersonalNotifications(query, request);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
