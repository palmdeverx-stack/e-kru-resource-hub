import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { schoolHasFeature } from 'src/lib/school-subscription';
import { decryptLineCredential } from 'src/lib/line-credentials';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ guardianId: string }> };

const MAX_MESSAGE_LENGTH = 1000;

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

export async function POST(request: Request, { params }: RouteParams) {
  const { guardianId } = await params;
  const access = await authorize(request, guardianId);
  if (!access?.caller.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ส่งข้อความถึงผู้ปกครอง' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return NextResponse.json({ message: 'กรุณากรอกข้อความ' }, { status: 400 });
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { message: `ข้อความยาวเกินไป (สูงสุด ${MAX_MESSAGE_LENGTH} ตัวอักษร)` },
      { status: 400 }
    );
  }
  if (!access.guardian.line_user_id) {
    return NextResponse.json({ message: 'ผู้ปกครองยังไม่ได้เชื่อม LINE' }, { status: 409 });
  }

  const { data: integration } = await supabaseAdmin
    .from('school_line_integrations')
    .select('is_enabled, channel_access_token_encrypted')
    .eq('school_id', access.caller.schoolId)
    .maybeSingle();
  if (!integration?.is_enabled) {
    return NextResponse.json(
      { message: 'ผู้ดูแลโรงเรียนยังไม่ได้เปิดการแจ้งเตือน LINE' },
      { status: 409 }
    );
  }
  if (!integration.channel_access_token_encrypted) {
    return NextResponse.json({ message: 'ยังไม่ได้บันทึก Channel access token' }, { status: 409 });
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${decryptLineCredential(integration.channel_access_token_encrypted)}`,
      },
      body: JSON.stringify({
        to: access.guardian.line_user_id,
        messages: [{ type: 'text', text }],
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
    return NextResponse.json({ message: 'ไม่สามารถเชื่อมต่อ LINE Messaging API ได้' }, { status: 502 });
  }
}
