import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

type Relation = Record<string, any> | null;

const RECENT_LIMIT = 6;

export async function GET(request: Request) {
  const caller = requireRole(request, ['teacher']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { data: teachingRows, error: teachingError } = await supabaseAdmin
    .from('teacher_assignments')
    .select(
      `id, classroom_id,
       subject:subjects(id, code, name, image_url),
       classroom:classrooms(id, name, grade_level, academic_year:academic_years(year)),
       semester:semesters(id, name, is_active, start_date, end_date)`
    )
    .eq('teacher_id', caller.sub);

  if (teachingError) {
    return NextResponse.json({ message: teachingError.message }, { status: 500 });
  }

  const teachingIds = (teachingRows ?? []).map((row) => row.id);

  if (!teachingIds.length) {
    return NextResponse.json({ recent_assignments: [] });
  }

  const { data: assignmentRows, error: assignmentError } = await supabaseAdmin
    .from('assignments')
    .select('id, teacher_assignment_id, title, full_score, category, created_at')
    .in('teacher_assignment_id', teachingIds)
    .order('created_at', { ascending: false })
    .limit(RECENT_LIMIT);

  if (assignmentError) {
    return NextResponse.json({ message: assignmentError.message }, { status: 500 });
  }

  const assignments = assignmentRows ?? [];
  const assignmentIds = assignments.map((row) => row.id);
  const classroomIds = Array.from(
    new Set(
      (teachingRows ?? [])
        .filter((row) => assignments.some((a) => a.teacher_assignment_id === row.id))
        .map((row) => (row.classroom as unknown as { id: string } | null)?.id)
        .filter(Boolean) as string[]
    )
  );

  const [enrollmentsResult, scoresResult] = await Promise.all([
    classroomIds.length
      ? supabaseAdmin
          .from('enrollments')
          .select('student_id, classroom_id')
          .in('classroom_id', classroomIds)
      : Promise.resolve({ data: [], error: null }),
    assignmentIds.length
      ? supabaseAdmin
          .from('scores')
          .select('assignment_id, student_id, score, status')
          .in('assignment_id', assignmentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (enrollmentsResult.error || scoresResult.error) {
    return NextResponse.json(
      { message: enrollmentsResult.error?.message ?? scoresResult.error?.message },
      { status: 500 }
    );
  }

  const enrollmentCountByClassroom = new Map<string, number>();
  (enrollmentsResult.data ?? []).forEach((row) => {
    enrollmentCountByClassroom.set(
      row.classroom_id,
      (enrollmentCountByClassroom.get(row.classroom_id) ?? 0) + 1
    );
  });

  const teachingById = new Map((teachingRows ?? []).map((row) => [row.id, row]));
  const scoreRows = scoresResult.data ?? [];

  const recentAssignments = assignments.map((assignment) => {
    const assignmentScores = scoreRows.filter((score) => score.assignment_id === assignment.id);
    const teaching = teachingById.get(assignment.teacher_assignment_id);
    const classroom = teaching?.classroom as unknown as { id: string } | null;

    return {
      ...assignment,
      full_score: Number(assignment.full_score),
      subject: teaching?.subject as unknown as Relation,
      classroom: teaching?.classroom as unknown as Relation,
      semester: teaching?.semester as unknown as Relation,
      student_count: classroom ? (enrollmentCountByClassroom.get(classroom.id) ?? 0) : 0,
      submitted_count: assignmentScores.filter((score) =>
        ['submitted', 'late', 'pending_review'].includes(score.status)
      ).length,
      graded_count: assignmentScores.filter((score) => score.score !== null).length,
    };
  });

  return NextResponse.json({ recent_assignments: recentAssignments });
}
