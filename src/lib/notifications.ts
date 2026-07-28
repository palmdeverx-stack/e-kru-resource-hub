import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

export async function createNotifications(
  notifications: Array<{
    userId: string;
    schoolId: string;
    type: string;
    title: string;
    body?: string;
    link?: string;
  }>
): Promise<void> {
  if (!notifications.length) return;

  await supabaseAdmin.from('notifications').insert(
    notifications.map((notification) => ({
      user_id: notification.userId,
      school_id: notification.schoolId,
      type: notification.type,
      title: notification.title,
      body: notification.body ?? null,
      link: notification.link ?? null,
    }))
  );
}
