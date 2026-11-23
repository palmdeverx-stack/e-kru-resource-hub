import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

import { filterPersonalNotifications } from './scope';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
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

  const query = supabaseAdmin
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .eq('user_id', caller.sub)
    .order('created_at', { ascending: false })
    .limit(30);
  const { data, error } = await filterPersonalNotifications(query, request);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      notifications: data ?? [],
      unreadCount: (data ?? []).filter((notification) => !notification.read_at).length,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
