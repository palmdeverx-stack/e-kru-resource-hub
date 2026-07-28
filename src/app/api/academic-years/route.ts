import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canManageViaPermission } from 'src/lib/department-permission-access';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('academic_years')
    .select('id, year, start_date, end_date, is_active, created_at')
    .eq('school_id', caller.schoolId)
    .order('year', { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ academicYears: data });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller || !(await canManageViaPermission(caller, 'academic_years.manage'))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { year, startDate, endDate } = await request.json();

  if (!year || !startDate || !endDate) {
    return NextResponse.json(
      { message: 'กรุณากรอกปีการศึกษา วันที่เริ่มต้น และวันที่สิ้นสุด' },
      { status: 400 }
    );
  }

  if (new Date(endDate) < new Date(startDate)) {
    return NextResponse.json({ message: 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น' }, { status: 400 });
  }

  const { data: overlapping } = await supabaseAdmin
    .from('academic_years')
    .select('year, start_date, end_date')
    .eq('school_id', caller.schoolId)
    .lte('start_date', endDate)
    .gte('end_date', startDate)
    .limit(1);

  if (overlapping?.length) {
    const [existing] = overlapping;
    return NextResponse.json(
      {
        message: `ช่วงวันที่ทับกับปีการศึกษา ${existing.year} (${existing.start_date} ถึง ${existing.end_date})`,
      },
      { status: 409 }
    );
  }

  const { data: academicYear, error } = await supabaseAdmin
    .from('academic_years')
    .insert({
      year: String(year).trim(),
      start_date: startDate,
      end_date: endDate,
      school_id: caller.schoolId,
    })
    .select('id, year, start_date, end_date, is_active, created_at')
    .single();

  if (error || !academicYear) {
    return NextResponse.json(
      { message: error?.message ?? 'Failed to create academic year' },
      { status: 500 }
    );
  }

  return NextResponse.json({ academicYear }, { status: 201 });
}
