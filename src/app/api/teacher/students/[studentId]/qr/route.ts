import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { schoolHasFeature } from 'src/lib/school-subscription';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ studentId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  if (
    caller.role === 'teacher' &&
    !(await schoolHasFeature(caller.schoolId, 'teacher.qr_attendance'))
  ) {
    return NextResponse.json({ message: 'แพ็กเกจโรงเรียนไม่รองรับ QR เช็คชื่อ' }, { status: 403 });
  }

  const { studentId } = await params;
  const body = await request.json().catch(() => ({}));
  const regenerate = body?.regenerate === true;

  const { data: student } = await supabaseAdmin
    .from('app_users')
    .select('id, username, first_name, last_name, student_code, school_id, role')
    .eq('id', studentId)
    .eq('school_id', caller.schoolId)
    .eq('role', 'student')
    .maybeSingle();

  if (!student) {
    return NextResponse.json({ message: 'ไม่พบนักเรียนในโรงเรียนของคุณ' }, { status: 404 });
  }

  if (caller.role === 'teacher') {
    const { data: enrollments } = await supabaseAdmin
      .from('enrollments')
      .select('classroom_id')
      .eq('student_id', studentId);
    const classroomIds = (enrollments ?? []).map((row) => row.classroom_id);
    const { data: ownedClassroom } = classroomIds.length
      ? await supabaseAdmin
          .from('classroom_homeroom_teachers')
          .select('classroom:classrooms!inner(id, school_id)')
          .eq('teacher_id', caller.sub)
          .eq('classroom.school_id', caller.schoolId)
          .in('classroom_id', classroomIds)
          .limit(1)
          .maybeSingle()
      : { data: null };

    if (!ownedClassroom) {
      return NextResponse.json(
        { message: 'คุณไม่ใช่ครูประจำชั้นของนักเรียนคนนี้' },
        { status: 403 }
      );
    }
  }

  const { data: existing } = await supabaseAdmin
    .from('student_qr_codes')
    .select('id, token, is_active')
    .eq('student_id', studentId)
    .maybeSingle();

  let qrCode = existing;
  if (!existing) {
    const { data, error } = await supabaseAdmin
      .from('student_qr_codes')
      .insert({
        student_id: studentId,
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
  } else if (regenerate || !existing.is_active) {
    const { data, error } = await supabaseAdmin
      .from('student_qr_codes')
      .update({
        token: crypto.randomUUID(),
        is_active: true,
        issued_by: caller.sub,
      })
      .eq('id', existing.id)
      .eq('school_id', caller.schoolId)
      .select('id, token, is_active')
      .single();
    if (error || !data) {
      return NextResponse.json(
        { message: error?.message ?? 'ไม่สามารถออก QR ใหม่ได้' },
        { status: 500 }
      );
    }
    qrCode = data;
  }

  return NextResponse.json({
    qr: {
      id: qrCode!.id,
      payload: `ISCORE-STUDENT:${qrCode!.token}`,
      student,
    },
  });
}
