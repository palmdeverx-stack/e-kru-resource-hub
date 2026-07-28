import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function GET(request: Request) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const semesterId = new URL(request.url).searchParams.get('semesterId');
  if (!semesterId) {
    return NextResponse.json({ message: 'กรุณาเลือกภาคเรียน' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('schedule_periods')
    .select('id, semester_id, period_number, name, start_time, end_time, is_break')
    .eq('school_id', caller.schoolId)
    .eq('semester_id', semesterId)
    .order('start_time');

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ periods: data });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'เฉพาะผู้ดูแลโรงเรียนเท่านั้น' }, { status: 403 });
  }

  const { semesterId, periodNumber, name, startTime, endTime, isBreak } = await request.json();
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedNumber = isBreak ? null : Number(periodNumber);

  if (
    !semesterId ||
    !normalizedName ||
    normalizedName.length > 100 ||
    !validTime(startTime) ||
    !validTime(endTime) ||
    startTime >= endTime ||
    (!isBreak && (!Number.isInteger(normalizedNumber) || (normalizedNumber ?? 0) < 1))
  ) {
    return NextResponse.json({ message: 'ข้อมูลคาบเรียนไม่ถูกต้อง' }, { status: 400 });
  }

  const { data: semester } = await supabaseAdmin
    .from('semesters')
    .select('id, academic_year:academic_years!inner(school_id)')
    .eq('id', semesterId)
    .eq('academic_year.school_id', caller.schoolId)
    .maybeSingle();
  if (!semester) return NextResponse.json({ message: 'ไม่พบภาคเรียนนี้' }, { status: 404 });

  const { data: periods } = await supabaseAdmin
    .from('schedule_periods')
    .select('start_time, end_time')
    .eq('school_id', caller.schoolId)
    .eq('semester_id', semesterId);
  const overlaps = (periods ?? []).some(
    (period) => toMinutes(startTime) < toMinutes(period.end_time) && toMinutes(endTime) > toMinutes(period.start_time)
  );
  if (overlaps) {
    return NextResponse.json({ message: 'ช่วงเวลานี้ซ้อนกับคาบหรือช่วงพักที่มีอยู่แล้ว' }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from('schedule_periods')
    .insert({
      school_id: caller.schoolId,
      semester_id: semesterId,
      period_number: normalizedNumber,
      name: normalizedName,
      start_time: startTime,
      end_time: endTime,
      is_break: !!isBreak,
    })
    .select('id, semester_id, period_number, name, start_time, end_time, is_break')
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  await supabaseAdmin
    .from('classroom_schedule_approvals')
    .update({
      status: 'draft',
      submitted_by: null,
      submitted_at: null,
      signature_url: null,
      signature_signed_at: null,
      submitter_signature_url: null,
      submitter_signature_signed_at: null,
    })
    .eq('school_id', caller.schoolId)
    .eq('semester_id', semesterId)
    .in('status', ['submitted', 'approved']);

  return NextResponse.json({ period: data }, { status: 201 });
}
