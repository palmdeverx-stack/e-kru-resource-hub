import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { schoolHasFeature } from 'src/lib/school-subscription';

// ----------------------------------------------------------------------
// Self-service LINE linking for the logged-in teacher — mirrors
// src/app/api/guardians/[guardianId]/line-link/route.ts, but simpler since
// the caller is always linking their own account (no third-party
// classroom-relationship check needed).

export async function GET(request: Request) {
  const caller = requireRole(request, ['teacher']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตรวจสอบการเชื่อม LINE' }, { status: 403 });
  }

  const [{ data: teacher }, { data: pendingLink }] = await Promise.all([
    supabaseAdmin
      .from('app_users')
      .select('line_display_name, line_linked_at, line_notifications_enabled')
      .eq('id', caller.sub)
      .eq('school_id', caller.schoolId)
      .maybeSingle(),
    supabaseAdmin
      .from('teacher_line_link_tokens')
      .select('expires_at, used_at')
      .eq('teacher_id', caller.sub)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    linked: Boolean(teacher?.line_linked_at),
    displayName: teacher?.line_display_name ?? null,
    linkedAt: teacher?.line_linked_at ?? null,
    notificationsEnabled: teacher?.line_notifications_enabled ?? false,
    invitation: pendingLink
      ? {
          expiresAt: pendingLink.expires_at,
          used: Boolean(pendingLink.used_at),
          expired: pendingLink.expires_at < new Date().toISOString(),
        }
      : null,
  });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['teacher']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เชื่อม LINE' }, { status: 403 });
  }
  if (!(await schoolHasFeature(caller.schoolId, 'admin.line_notifications'))) {
    return NextResponse.json(
      { message: 'ผู้ดูแลโรงเรียนยังไม่ได้เปิดการแจ้งเตือน LINE' },
      { status: 409 }
    );
  }
  const { data: integration } = await supabaseAdmin
    .from('school_line_integrations')
    .select('is_enabled, oa_basic_id')
    .eq('school_id', caller.schoolId)
    .maybeSingle();
  if (!integration?.is_enabled) {
    return NextResponse.json(
      { message: 'ผู้ดูแลโรงเรียนยังไม่ได้เปิดการแจ้งเตือน LINE' },
      { status: 409 }
    );
  }

  const code = randomBytes(4).toString('hex').toUpperCase();
  const tokenHash = createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  const { error } = await supabaseAdmin.from('teacher_line_link_tokens').upsert(
    {
      school_id: caller.schoolId,
      teacher_id: caller.sub,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: caller.sub,
      used_at: null,
    },
    { onConflict: 'teacher_id' }
  );
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const message = `TEACHER ${code}`;
  const normalizedBasicId = integration.oa_basic_id
    ? `@${integration.oa_basic_id.replace(/^@+/, '')}`
    : null;
  return NextResponse.json({
    code,
    expiresAt,
    message,
    addFriendUrl: normalizedBasicId
      ? `https://line.me/R/ti/p/${encodeURIComponent(normalizedBasicId)}`
      : null,
    lineChatUrl: normalizedBasicId
      ? `https://line.me/R/oaMessage/${encodeURIComponent(normalizedBasicId)}/?${encodeURIComponent(
          message
        )}`
      : null,
  });
}

export async function DELETE(request: Request) {
  const caller = requireRole(request, ['teacher']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ยกเลิกการเชื่อม LINE' }, { status: 403 });
  }
  const { error } = await supabaseAdmin
    .from('app_users')
    .update({ line_user_id: null, line_display_name: null, line_linked_at: null })
    .eq('id', caller.sub)
    .eq('school_id', caller.schoolId);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  await supabaseAdmin.from('teacher_line_link_tokens').delete().eq('teacher_id', caller.sub);
  return NextResponse.json({ success: true });
}
