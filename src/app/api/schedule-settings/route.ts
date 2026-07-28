import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  const caller = requireRole(request, ['student', 'teacher', 'school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('schools')
    .select('schedule_mode')
    .eq('id', caller.schoolId)
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ scheduleMode: data?.schedule_mode ?? 'hour' });
}

export async function PATCH(request: Request) {
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'เฉพาะผู้ดูแลโรงเรียนเท่านั้น' }, { status: 403 });
  }

  const { scheduleMode } = await request.json();
  if (!['hour', 'period'].includes(scheduleMode)) {
    return NextResponse.json({ message: 'รูปแบบตารางเรียนไม่ถูกต้อง' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('schools')
    .update({ schedule_mode: scheduleMode })
    .eq('id', caller.schoolId);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ scheduleMode });
}
