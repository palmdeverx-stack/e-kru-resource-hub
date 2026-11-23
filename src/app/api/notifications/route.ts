import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

import { getPaymentReason } from 'src/sections/marketplace/shared/payment-message';

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
    return NextResponse.json({ message: 'โหลดการแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }

  return NextResponse.json(
    {
      notifications: (data ?? []).map((notification) =>
        notification.type === 'marketplace_stripe_rejected'
          ? {
              ...notification,
              body: getPaymentReason({ payment_method: 'stripe', rejection_reason: notification.body }),
            }
          : notification
      ),
      unreadCount: (data ?? []).filter((notification) => !notification.read_at).length,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
