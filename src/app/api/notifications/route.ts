import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  const caller = requireRole(request, [
    'master_admin',
    'school_admin',
    'teacher',
    'student',
    'marketplace_user',
  ]);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const marketplaceOnly = new URL(request.url).searchParams.get('scope') === 'marketplace';
  let query = supabaseAdmin
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .eq('user_id', caller.sub)
    .order('created_at', { ascending: false })
    .limit(30);
  if (marketplaceOnly) query = query.like('type', 'marketplace_%');

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    notifications: data ?? [],
    unreadCount: (data ?? []).filter((notification) => !notification.read_at).length,
  });
}
