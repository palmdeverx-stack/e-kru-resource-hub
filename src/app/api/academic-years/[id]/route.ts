import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canManageViaPermission } from 'src/lib/department-permission-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller || !(await canManageViaPermission(caller, 'academic_years.manage'))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { year, startDate, endDate, isActive } = await request.json();

  if (typeof year !== 'string' || !year.trim() || !startDate || !endDate) {
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
    .neq('id', id)
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

  const { data, error } = await supabaseAdmin
    .from('academic_years')
    .update({
      year: year.trim(),
      start_date: startDate,
      end_date: endDate,
      ...(typeof isActive === 'boolean' && { is_active: isActive }),
    })
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .select('id, year, start_date, end_date, is_active, created_at')
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'ไม่พบปีการศึกษานี้' }, { status: 404 });

  return NextResponse.json({ academicYear: data });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller || !(await canManageViaPermission(caller, 'academic_years.manage'))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('academic_years')
    .delete()
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'ไม่พบปีการศึกษานี้' }, { status: 404 });

  return NextResponse.json({ success: true });
}
