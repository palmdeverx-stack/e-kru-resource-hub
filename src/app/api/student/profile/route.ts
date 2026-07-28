import { NextResponse } from 'next/server';

import { today, fIsBetween } from 'src/utils/format-time';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

type AcademicYear = {
  id: string;
  year: string;
  start_date: string | null;
  end_date: string | null;
  semesters: Semester[];
};

type Semester = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};

type Classroom = {
  name: string;
  grade_level: string | null;
  academic_year: AcademicYear | null;
};

async function loadStudentProfile(studentId: string, schoolId: string | null) {
  const [
    { data: student, error: studentError },
    { data: school, error: schoolError },
    enrollmentResult,
    guardianResult,
  ] = await Promise.all([
    supabaseAdmin
      .from('app_users')
      .select('id, username, email, first_name, last_name, avatar_url, student_status, created_at')
      .eq('id', studentId)
      .eq('role', 'student')
      .maybeSingle(),
    schoolId
      ? supabaseAdmin
          .from('schools')
          .select('id, name, code, logo_url')
          .eq('id', schoolId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseAdmin
      .from('enrollments')
      .select(
        `id, student_number, created_at,
           classroom:classrooms(name, grade_level,
             academic_year:academic_years(id, year, start_date, end_date,
               semesters(id, name, start_date, end_date, is_active)))`
      )
      .eq('student_id', studentId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('student_guardians')
      .select('id, full_name, relationship, phone, email, occupation, address, notes, is_primary')
      .eq('student_id', studentId)
      .order('is_primary', { ascending: false })
      .order('created_at'),
  ]);

  if (studentError || schoolError || enrollmentResult.error || guardianResult.error) {
    throw new Error(
      studentError?.message ??
        schoolError?.message ??
        enrollmentResult.error?.message ??
        guardianResult.error?.message
    );
  }

  if (!student) return null;

  const enrollments = enrollmentResult.data.map((row) => ({
    ...row,
    classroom: row.classroom as unknown as Classroom,
  }));
  const enrollment =
    enrollments.find((row) =>
      fIsBetween(
        today(),
        row.classroom?.academic_year?.start_date,
        row.classroom?.academic_year?.end_date
      )
    ) ??
    enrollments[0] ??
    null;

  const semesters = enrollment?.classroom?.academic_year?.semesters ?? [];
  const semester =
    semesters.find((item) => fIsBetween(today(), item.start_date, item.end_date)) ??
    semesters.find((item) => item.is_active) ??
    semesters[0] ??
    null;

  return { ...student, school, enrollment, semester, guardians: guardianResult.data };
}

export async function GET(request: Request) {
  const caller = requireRole(request, ['student']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  try {
    const profile = await loadStudentProfile(caller.sub, caller.schoolId);

    if (!profile) {
      return NextResponse.json({ message: 'ไม่พบข้อมูลนักเรียน' }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลโปรไฟล์ได้' },
      { status: 500 }
    );
  }
}
