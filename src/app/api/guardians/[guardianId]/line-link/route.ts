import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { schoolHasFeature } from 'src/lib/school-subscription';
import { decryptLineCredential } from 'src/lib/line-credentials';
import { signGuardianPortalIdentityToken } from 'src/lib/guardian-portal-token';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ guardianId: string }> };

async function authorize(request: Request, guardianId: string) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller?.schoolId) return null;
  if (!(await schoolHasFeature(caller.schoolId, 'admin.line_notifications'))) return null;
  const { data: guardian } = await supabaseAdmin
    .from('student_guardians')
    .select('id, full_name, student_id, line_user_id')
    .eq('id', guardianId)
    .eq('school_id', caller.schoolId)
    .maybeSingle();
  if (!guardian) return null;
  if (caller.role === 'teacher') {
    const { data: enrollments } = await supabaseAdmin
      .from('enrollments')
      .select('classroom_id')
      .eq('student_id', guardian.student_id);
    const classroomIds = Array.from(
      new Set((enrollments ?? []).map((enrollment) => enrollment.classroom_id))
    );
    if (!classroomIds.length) return null;
    const [{ data: homeroom }, { data: assignment }] = await Promise.all([
      supabaseAdmin
        .from('classroom_homeroom_teachers')
        .select('classroom_id')
        .eq('teacher_id', caller.sub)
        .in('classroom_id', classroomIds)
        .limit(1),
      supabaseAdmin
        .from('teacher_assignments')
        .select('classroom_id')
        .eq('teacher_id', caller.sub)
        .in('classroom_id', classroomIds)
        .limit(1),
    ]);
    if (!homeroom?.length && !assignment?.length) return null;
  }
  return { caller, guardian };
}

export async function GET(request: Request, { params }: RouteParams) {
  const { guardianId } = await params;
  const access = await authorize(request, guardianId);
  if (!access?.caller.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตรวจสอบการเชื่อม LINE' }, { status: 403 });
  }

  const [{ data: guardian }, { data: pendingLink }] = await Promise.all([
    supabaseAdmin
      .from('student_guardians')
      .select('line_display_name, line_linked_at, line_notifications_enabled')
      .eq('id', guardianId)
      .eq('school_id', access.caller.schoolId)
      .maybeSingle(),
    supabaseAdmin
      .from('guardian_line_link_tokens')
      .select('expires_at, used_at')
      .eq('guardian_id', guardianId)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    linked: Boolean(guardian?.line_linked_at),
    displayName: guardian?.line_display_name ?? null,
    linkedAt: guardian?.line_linked_at ?? null,
    notificationsEnabled: guardian?.line_notifications_enabled ?? false,
    invitation: pendingLink
      ? {
          expiresAt: pendingLink.expires_at,
          used: Boolean(pendingLink.used_at),
          expired: pendingLink.expires_at < new Date().toISOString(),
        }
      : null,
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { guardianId } = await params;
  const access = await authorize(request, guardianId);
  if (!access?.caller.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เชื่อม LINE ผู้ปกครอง' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const action =
    body?.action === 'hello' ? 'hello' : body?.action === 'profile' ? 'profile' : 'invite';
  const { data: integration } = await supabaseAdmin
    .from('school_line_integrations')
    .select('is_enabled, oa_basic_id, channel_access_token_encrypted')
    .eq('school_id', access.caller.schoolId)
    .maybeSingle();
  if (!integration?.is_enabled) {
    return NextResponse.json(
      { message: 'ผู้ดูแลโรงเรียนยังไม่ได้เปิดการแจ้งเตือน LINE' },
      { status: 409 }
    );
  }

  if (action === 'hello' || action === 'profile') {
    if (!access.guardian.line_user_id) {
      return NextResponse.json({ message: 'ผู้ปกครองยังไม่ได้เชื่อม LINE' }, { status: 409 });
    }
    if (!integration.channel_access_token_encrypted) {
      return NextResponse.json(
        { message: 'ยังไม่ได้บันทึก Channel access token' },
        { status: 409 }
      );
    }
    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('name')
      .eq('id', access.caller.schoolId)
      .maybeSingle();
    try {
      const profileUrl = new URL('/api/guardian/portal/session/', request.url);
      if (action === 'profile') {
        profileUrl.searchParams.set(
          'token',
          signGuardianPortalIdentityToken(access.caller.schoolId, access.guardian.line_user_id)
        );
      }
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${decryptLineCredential(
            integration.channel_access_token_encrypted
          )}`,
        },
        body: JSON.stringify({
          to: access.guardian.line_user_id,
          messages: [
            ...(action === 'profile'
              ? [
                  {
                    type: 'text',
                    text: `คุณ ${access.guardian.full_name}\nเปิดดูข้อมูลนักเรียนของ ${
                      school?.name ?? 'โรงเรียน'
                    } ได้จากปุ่มด้านล่าง`,
                  },
                  {
                    type: 'flex',
                    altText: 'เปิดข้อมูลนักเรียน',
                    contents: {
                      type: 'bubble',
                      size: 'kilo',
                      body: {
                        type: 'box',
                        layout: 'vertical',
                        spacing: 'md',
                        contents: [
                          {
                            type: 'text',
                            text: 'ข้อมูลนักเรียน',
                            weight: 'bold',
                            size: 'xl',
                            color: '#172B4D',
                          },
                          {
                            type: 'text',
                            text: 'ดูโปรไฟล์และประวัติการเข้าเรียนของบุตรหลาน',
                            size: 'sm',
                            color: '#6B7A90',
                            wrap: true,
                          },
                          {
                            type: 'text',
                            text: 'กรุณากรอกรหัสนักเรียนที่เชื่อมกับ LINE นี้',
                            size: 'xs',
                            color: '#8A94A6',
                            wrap: true,
                          },
                        ],
                      },
                      footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                          {
                            type: 'button',
                            style: 'primary',
                            color: '#1976D2',
                            action: {
                              type: 'uri',
                              label: 'เปิดข้อมูลนักเรียน',
                              uri: profileUrl.toString(),
                            },
                          },
                        ],
                      },
                    },
                  },
                ]
              : [
                  {
                    type: 'text',
                    text: `สวัสดีคุณ ${access.guardian.full_name}\nเชื่อมต่อ LINE กับ ${
                      school?.name ?? 'โรงเรียน'
                    } เรียบร้อยแล้ว\nข้อความนี้เป็นการทดสอบการแจ้งเตือนจากระบบ`,
                  },
                ]),
          ],
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        return NextResponse.json(
          { message: result?.message ?? 'LINE ไม่สามารถส่งข้อความได้' },
          { status: 502 }
        );
      }
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json(
        { message: 'ไม่สามารถเชื่อมต่อ LINE Messaging API ได้' },
        { status: 502 }
      );
    }
  }

  const code = randomBytes(4).toString('hex').toUpperCase();
  const tokenHash = createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  const { error } = await supabaseAdmin.from('guardian_line_link_tokens').upsert(
    {
      school_id: access.caller.schoolId,
      guardian_id: guardianId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: access.caller.sub,
      used_at: null,
    },
    { onConflict: 'guardian_id' }
  );
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const message = `LINK ${code}`;
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

export async function DELETE(request: Request, { params }: RouteParams) {
  const { guardianId } = await params;
  const access = await authorize(request, guardianId);
  if (!access?.caller.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ยกเลิกการเชื่อม LINE' }, { status: 403 });
  }
  const { error } = await supabaseAdmin
    .from('student_guardians')
    .update({
      line_user_id: null,
      line_display_name: null,
      line_linked_at: null,
    })
    .eq('id', guardianId)
    .eq('school_id', access.caller.schoolId);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  await supabaseAdmin.from('guardian_line_link_tokens').delete().eq('guardian_id', guardianId);
  return NextResponse.json({ success: true });
}
