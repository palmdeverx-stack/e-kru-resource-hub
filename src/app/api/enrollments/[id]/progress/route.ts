import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { data: enrollment, error: enrollmentError } = await supabaseAdmin
    .from('enrollments')
    .select(
      `id, student_number,
       student:app_users!enrollments_student_id_fkey(id, username, first_name, last_name),
       classroom:classrooms!inner(id, name, school_id, academic_years(year))`
    )
    .eq('id', id)
    .eq('classroom.school_id', caller.schoolId)
    .maybeSingle();

  if (enrollmentError) {
    return NextResponse.json({ message: enrollmentError.message }, { status: 500 });
  }
  if (!enrollment) {
    return NextResponse.json({ message: 'ไม่พบข้อมูลการลงทะเบียนของนักเรียน' }, { status: 404 });
  }

  const student = enrollment.student as unknown as {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
  };
  const classroom = enrollment.classroom as unknown as {
    id: string;
    name: string;
    academic_years: { year: string } | null;
  };

  const { data: teachingRows, error: teachingError } = await supabaseAdmin
    .from('teacher_assignments')
    .select(
      `id,
       teacher:app_users!teacher_assignments_teacher_id_fkey(id, username, first_name, last_name),
       subject:subjects(id, code, name, credits, image_url),
       semester:semesters(id, name)`
    )
    .eq('classroom_id', classroom.id)
    .order('created_at');

  if (teachingError) {
    return NextResponse.json({ message: teachingError.message }, { status: 500 });
  }

  const teachingIds = teachingRows.map((row) => row.id);
  const { data: assignments, error: assignmentsError } = teachingIds.length
    ? await supabaseAdmin
        .from('assignments')
        .select('id, teacher_assignment_id, title, description, full_score, created_at')
        .in('teacher_assignment_id', teachingIds)
        .order('created_at', { ascending: false })
    : { data: [], error: null };

  if (assignmentsError) {
    return NextResponse.json({ message: assignmentsError.message }, { status: 500 });
  }

  const assignmentIds = assignments.map((assignment) => assignment.id);
  const { data: scores, error: scoresError } = assignmentIds.length
    ? await supabaseAdmin
        .from('scores')
        .select('assignment_id, score, feedback, status')
        .eq('student_id', student.id)
        .in('assignment_id', assignmentIds)
    : { data: [], error: null };

  if (scoresError) {
    return NextResponse.json({ message: scoresError.message }, { status: 500 });
  }

  const scoreByAssignmentId = new Map(scores.map((score) => [score.assignment_id, score]));
  const subjects = teachingRows.map((teaching) => ({
    id: teaching.id,
    teacher: teaching.teacher,
    subject: teaching.subject,
    semester: teaching.semester,
    assignments: assignments
      .filter((assignment) => assignment.teacher_assignment_id === teaching.id)
      .map((assignment) => {
        const score = scoreByAssignmentId.get(assignment.id);
        return {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          full_score: Number(assignment.full_score),
          created_at: assignment.created_at,
          score: score?.score === null || score?.score === undefined ? null : Number(score.score),
          feedback: score?.feedback ?? null,
          status: score?.status ?? 'not_submitted',
        };
      }),
  }));

  return NextResponse.json({
    enrollment: {
      id: enrollment.id,
      student_number: enrollment.student_number,
      student,
      classroom,
    },
    subjects,
  });
}
