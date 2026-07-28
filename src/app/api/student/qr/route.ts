import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { schoolHasFeature } from 'src/lib/school-subscription';

// ----------------------------------------------------------------------

export async function POST(request: Request) {
  const caller = requireRole(request, ['student']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  if (!(await schoolHasFeature(caller.schoolId, 'student.qr'))) {
    return NextResponse.json({ message: 'แพ็กเกจโรงเรียนไม่รองรับ QR นักเรียน' }, { status: 403 });
  }

  const { data: student } = await supabaseAdmin
    .from('app_users')
    .select(
      'id, username, first_name, last_name, student_code, avatar_url, school_id, role, is_active, student_status'
    )
    .eq('id', caller.sub)
    .eq('school_id', caller.schoolId)
    .eq('role', 'student')
    .maybeSingle();

  if (!student || !student.is_active || (student.student_status ?? 'studying') !== 'studying') {
    return NextResponse.json(
      { message: 'บัญชีนักเรียนไม่มีสิทธิ์ใช้งาน QR เช็คชื่อ' },
      { status: 403 }
    );
  }

  const { data: existing } = await supabaseAdmin
    .from('student_qr_codes')
    .select('id, token, is_active')
    .eq('student_id', caller.sub)
    .eq('school_id', caller.schoolId)
    .maybeSingle();

  let qrCode = existing;
  if (!existing) {
    const { data, error } = await supabaseAdmin
      .from('student_qr_codes')
      .insert({
        student_id: caller.sub,
        school_id: caller.schoolId,
        issued_by: caller.sub,
      })
      .select('id, token, is_active')
      .single();
    if (error || !data) {
      return NextResponse.json(
        { message: error?.message ?? 'ไม่สามารถออก QR ได้' },
        { status: 500 }
      );
    }
    qrCode = data;
  }

  if (!qrCode?.is_active) {
    return NextResponse.json(
      { message: 'QR นี้ถูกยกเลิกแล้ว กรุณาติดต่อครูประจำชั้นเพื่อออก QR ใหม่' },
      { status: 409 }
    );
  }

  return NextResponse.json({
    qr: {
      id: qrCode.id,
      payload: `ISCORE-STUDENT:${qrCode.token}`,
      student,
    },
  });
}
