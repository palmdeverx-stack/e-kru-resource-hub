import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

async function getOwnedEnrollment(id: string, schoolId: string | null) {
  if (!schoolId) return { data: null, error: null };

  return supabaseAdmin
    .from('enrollments')
    .select('id, student_id, classroom_id, classroom:classrooms!inner(school_id, academic_year_id)')
    .eq('id', id)
    .eq('classroom.school_id', schoolId)
    .maybeSingle();
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { data: enrollment } = await getOwnedEnrollment(id, caller.schoolId);
  if (!enrollment) {
    return NextResponse.json({ message: 'ไม่พบรายการลงทะเบียนนี้' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const classroomId = typeof body?.classroomId === 'string' ? body.classroomId : '';
  const studentNumber =
    typeof body?.studentNumber === 'string' ? body.studentNumber.trim() || null : null;

  if (!classroomId) {
    return NextResponse.json({ message: 'กรุณาเลือกห้องเรียน' }, { status: 400 });
  }
  if (studentNumber && !/^\d+$/.test(studentNumber)) {
    return NextResponse.json({ message: 'เลขที่ต้องเป็นตัวเลขเท่านั้น' }, { status: 400 });
  }

  const { data: classroom } = await supabaseAdmin
    .from('classrooms')
    .select('id, academic_year_id')
    .eq('id', classroomId)
    .eq('school_id', caller.schoolId)
    .maybeSingle();

  if (!classroom) {
    return NextResponse.json({ message: 'ไม่พบห้องเรียนนี้ในโรงเรียนของคุณ' }, { status: 404 });
  }

  if (classroomId !== enrollment.classroom_id) {
    const { data: student } = await supabaseAdmin
      .from('app_users')
      .select('is_active, student_status')
      .eq('id', enrollment.student_id)
      .eq('role', 'student')
      .maybeSingle();

    if (!student || student.is_active === false || student.student_status !== 'studying') {
      return NextResponse.json(
        { message: 'นักเรียนสถานะพ้นสภาพ ลาออก ย้าย หรือปิดใช้งาน ไม่สามารถย้ายห้องได้' },
        { status: 409 }
      );
    }

    const { data: duplicate } = await supabaseAdmin
      .from('enrollments')
      .select('id')
      .eq('student_id', enrollment.student_id)
      .eq('academic_year_id', classroom.academic_year_id)
      .neq('id', id)
      .maybeSingle();

    if (duplicate) {
      return NextResponse.json(
        { message: 'นักเรียนคนนี้มีห้องเรียนในปีการศึกษานี้แล้ว' },
        { status: 409 }
      );
    }
  }

  const { data: updated, error } = await supabaseAdmin
    .from('enrollments')
    .update({ classroom_id: classroomId, student_number: studentNumber })
    .eq('id', id)
    .select('id, student_id, classroom_id, student_number, created_at')
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถแก้ไขการลงทะเบียนได้' },
      { status: error?.code === '23505' ? 409 : 500 }
    );
  }

  return NextResponse.json({ enrollment: updated });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { data: enrollment } = await getOwnedEnrollment(id, caller.schoolId);
  if (!enrollment) {
    return NextResponse.json({ message: 'ไม่พบรายการลงทะเบียนนี้' }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from('enrollments').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ message: 'ไม่สามารถลบการลงทะเบียนได้' }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
