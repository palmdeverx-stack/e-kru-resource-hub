import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

type PromoteEntry = { studentId: string; classroomId: string; studentNumber?: string };

export async function POST(request: Request) {
  const caller = requireRole(request, ['school_admin']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { sourceClassroomId, entries } = await request.json();

  if (
    !sourceClassroomId ||
    !Array.isArray(entries) ||
    !entries.length ||
    entries.some((entry: PromoteEntry) => !entry.studentId || !entry.classroomId)
  ) {
    return NextResponse.json({ message: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  const { data: sourceClassroom } = await supabaseAdmin
    .from('classrooms')
    .select('id')
    .eq('id', sourceClassroomId)
    .eq('school_id', caller.schoolId)
    .maybeSingle();

  if (!sourceClassroom) {
    return NextResponse.json({ message: 'ไม่พบห้องเรียนต้นทาง' }, { status: 404 });
  }

  const destinationClassroomIds = Array.from(
    new Set(entries.map((entry: PromoteEntry) => entry.classroomId))
  );

  const { data: destinationClassrooms } = await supabaseAdmin
    .from('classrooms')
    .select('id, academic_year_id')
    .in('id', destinationClassroomIds)
    .eq('school_id', caller.schoolId);

  if (destinationClassrooms?.length !== destinationClassroomIds.length) {
    return NextResponse.json({ message: 'ไม่พบห้องเรียนปลายทางบางห้อง' }, { status: 404 });
  }

  const targetAcademicYearIds = new Set(destinationClassrooms.map((room) => room.academic_year_id));

  if (targetAcademicYearIds.size > 1) {
    return NextResponse.json(
      { message: 'ห้องปลายทางต้องอยู่ปีการศึกษาเดียวกันทั้งหมด' },
      { status: 400 }
    );
  }

  const studentIds = entries.map((entry: PromoteEntry) => entry.studentId);

  const { data: enrolled } = await supabaseAdmin
    .from('enrollments')
    .select('student_id')
    .eq('classroom_id', sourceClassroomId)
    .in('student_id', studentIds);

  const enrolledIds = new Set((enrolled ?? []).map((row) => row.student_id));
  const invalid = studentIds.some((studentId: string) => !enrolledIds.has(studentId));

  if (invalid) {
    return NextResponse.json(
      { message: 'นักเรียนบางคนไม่ได้อยู่ในห้องต้นทางนี้' },
      { status: 404 }
    );
  }

  const { data: eligibleStudents } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .in('id', studentIds)
    .eq('school_id', caller.schoolId)
    .eq('role', 'student')
    .eq('is_active', true)
    .eq('student_status', 'studying');

  if (eligibleStudents?.length !== new Set(studentIds).size) {
    return NextResponse.json(
      {
        message: 'ไม่สามารถเลื่อนชั้นได้ เนื่องจากมีนักเรียนสถานะพ้นสภาพ ลาออก ย้าย หรือปิดใช้งาน',
      },
      { status: 409 }
    );
  }

  const { data: saved, error } = await supabaseAdmin
    .from('enrollments')
    .upsert(
      entries.map((entry: PromoteEntry) => ({
        student_id: entry.studentId,
        classroom_id: entry.classroomId,
        student_number: entry.studentNumber || null,
      })),
      { onConflict: 'student_id,academic_year_id' }
    )
    .select('id, student_id, classroom_id, student_number, created_at');

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ enrollments: saved });
}
