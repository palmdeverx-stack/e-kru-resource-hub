import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

async function getSemesterForSchool(id: string, schoolId: string | null) {
  const { data } = await supabaseAdmin
    .from('semesters')
    .select('id, academic_year:academic_years!inner(id, school_id, start_date, end_date)')
    .eq('id', id)
    .eq('academic_year.school_id', schoolId)
    .maybeSingle();

  return data;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin']);

  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { id } = await params;
  const {
    name,
    startDate,
    endDate,
    isActive,
    gradeSubmissionDeadline,
    gradeReminderDays,
    gradeReminderNotifyInApp,
    gradeReminderNotifyLine,
  } = await request.json();

  if (!name || !startDate || !endDate) {
    return NextResponse.json(
      { message: 'กรุณากรอกชื่อภาคเรียน วันที่เริ่มต้น และวันที่สิ้นสุด' },
      { status: 400 }
    );
  }

  const hasDeadline = typeof gradeSubmissionDeadline === 'string' && gradeSubmissionDeadline;
  const parsedReminderDays = Number(gradeReminderDays);
  if (
    hasDeadline &&
    (!Number.isInteger(parsedReminderDays) || parsedReminderDays < 1)
  ) {
    return NextResponse.json(
      { message: 'กรุณาระบุจำนวนวันที่เตือนก่อนถึงกำหนดส่ง (อย่างน้อย 1 วัน)' },
      { status: 400 }
    );
  }

  const semester = await getSemesterForSchool(id, caller.schoolId);
  if (!semester) return NextResponse.json({ message: 'ไม่พบภาคเรียนนี้' }, { status: 404 });

  if (new Date(endDate) < new Date(startDate)) {
    return NextResponse.json({ message: 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น' }, { status: 400 });
  }

  const academicYear = Array.isArray(semester.academic_year)
    ? semester.academic_year[0]
    : semester.academic_year;

  if (
    (academicYear?.start_date && startDate < academicYear.start_date) ||
    (academicYear?.end_date && endDate > academicYear.end_date)
  ) {
    return NextResponse.json(
      { message: 'ช่วงวันที่ภาคเรียนต้องอยู่ภายในช่วงปีการศึกษา' },
      { status: 400 }
    );
  }

  const { data: overlapping } = await supabaseAdmin
    .from('semesters')
    .select('name, start_date, end_date')
    .eq('academic_year_id', academicYear?.id)
    .neq('id', id)
    .lte('start_date', endDate)
    .gte('end_date', startDate)
    .limit(1);

  if (overlapping?.length) {
    const [existing] = overlapping;
    return NextResponse.json(
      {
        message: `ช่วงวันที่ทับกับภาคเรียน ${existing.name} (${existing.start_date} ถึง ${existing.end_date})`,
      },
      { status: 409 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('semesters')
    .update({
      name: String(name).trim(),
      start_date: startDate,
      end_date: endDate,
      grade_submission_deadline: hasDeadline ? gradeSubmissionDeadline : null,
      grade_reminder_days: hasDeadline ? parsedReminderDays : null,
      grade_reminder_notify_in_app: gradeReminderNotifyInApp !== false,
      grade_reminder_notify_line: gradeReminderNotifyLine !== false,
      ...(typeof isActive === 'boolean' && { is_active: isActive }),
    })
    .eq('id', id)
    .select(
      'id, name, start_date, end_date, is_active, grade_submission_deadline, grade_reminder_days, grade_reminder_notify_in_app, grade_reminder_notify_line, created_at'
    )
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ semester: data });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin']);

  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { id } = await params;
  const semester = await getSemesterForSchool(id, caller.schoolId);
  if (!semester) return NextResponse.json({ message: 'ไม่พบภาคเรียนนี้' }, { status: 404 });

  const { error } = await supabaseAdmin.from('semesters').delete().eq('id', id);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
