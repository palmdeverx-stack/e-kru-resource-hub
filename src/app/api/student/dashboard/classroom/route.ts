import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import {
  fetchStudent,
  toEnrollments,
  fetchClassmates,
  fetchEnrollments,
  pickCurrentEnrollment,
  fetchHomeroomTeachers,
} from 'src/lib/student-dashboard-queries';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  const generatedAt = new Date().toISOString();
  const caller = requireRole(request, ['student']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const [{ data: student, error: studentError }, { data: enrollmentRows, error: enrollmentError }] =
    await Promise.all([fetchStudent(caller.sub), fetchEnrollments(caller.sub)]);

  if (studentError || enrollmentError) {
    return NextResponse.json(
      { message: studentError?.message ?? enrollmentError?.message },
      { status: 500 }
    );
  }

  if (!student) {
    return NextResponse.json({ message: 'ไม่พบข้อมูลนักเรียน' }, { status: 404 });
  }

  const enrollments = toEnrollments(enrollmentRows ?? []);
  const currentEnrollment = pickCurrentEnrollment(enrollments);
  const currentClassroomId = currentEnrollment?.classroom?.id;

  if (!currentClassroomId) {
    return NextResponse.json({
      generated_at: generatedAt,
      student,
      enrollments,
      class_members: [],
      homeroom_teachers: [],
    });
  }

  const [{ data: classmateRows, error: classmateError }, { data: homeroomRows, error: homeroomError }] =
    await Promise.all([fetchClassmates(currentClassroomId), fetchHomeroomTeachers(currentClassroomId)]);

  if (classmateError || homeroomError) {
    return NextResponse.json(
      { message: classmateError?.message ?? homeroomError?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    generated_at: generatedAt,
    student,
    enrollments,
    class_members: (classmateRows ?? []).map((row) => ({
      student: row.student,
      student_number: row.student_number,
      is_current_student: (row.student as unknown as { id: string }).id === caller.sub,
    })),
    homeroom_teachers: (homeroomRows ?? []).map((row) => row.teacher),
  });
}
