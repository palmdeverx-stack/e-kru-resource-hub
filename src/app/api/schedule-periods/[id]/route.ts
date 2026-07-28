import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'เฉพาะผู้ดูแลโรงเรียนเท่านั้น' }, { status: 403 });
  }

  const { id } = await params;
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

  const { data: periods } = await supabaseAdmin
    .from('schedule_periods')
    .select('id, start_time, end_time')
    .eq('school_id', caller.schoolId)
    .eq('semester_id', semesterId)
    .neq('id', id);
  const overlaps = (periods ?? []).some(
    (period) => toMinutes(startTime) < toMinutes(period.end_time) && toMinutes(endTime) > toMinutes(period.start_time)
  );
  if (overlaps) {
    return NextResponse.json({ message: 'ช่วงเวลานี้ซ้อนกับคาบหรือช่วงพักที่มีอยู่แล้ว' }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from('schedule_periods')
    .update({
      period_number: normalizedNumber,
      name: normalizedName,
      start_time: startTime,
      end_time: endTime,
      is_break: !!isBreak,
    })
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .eq('semester_id', semesterId)
    .select('id, semester_id, period_number, name, start_time, end_time, is_break')
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'ไม่พบคาบเรียนนี้' }, { status: 404 });

  if (!data.is_break) {
    await supabaseAdmin
      .from('teaching_schedules')
      .update({ start_time: data.start_time, end_time: data.end_time })
      .eq('schedule_period_id', data.id);
  }

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

  return NextResponse.json({ period: data });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'เฉพาะผู้ดูแลโรงเรียนเท่านั้น' }, { status: 403 });
  }

  const { id } = await params;
  const { data: period } = await supabaseAdmin
    .from('schedule_periods')
    .select('semester_id')
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .maybeSingle();
  if (!period) return NextResponse.json({ message: 'ไม่พบคาบเรียนนี้' }, { status: 404 });

  const { error } = await supabaseAdmin
    .from('schedule_periods')
    .delete()
    .eq('id', id)
    .eq('school_id', caller.schoolId);
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
    .eq('semester_id', period.semester_id)
    .in('status', ['submitted', 'approved']);

  return NextResponse.json({ success: true });
}
