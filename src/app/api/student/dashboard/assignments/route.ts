import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import {
  fetchScores,
  fetchStudent,
  toEnrollments,
  fetchEnrollments,
  fetchAssignments,
  fetchTeachingRows,
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
  const classroomIds = Array.from(
    new Set(enrollments.map((row) => row.classroom?.id).filter(Boolean))
  ) as string[];

  if (!classroomIds.length) {
    return NextResponse.json({
      generated_at: generatedAt,
      student,
      enrollments,
      subjects: [],
    });
  }

  const { data: teachingRows, error: teachingError } = await fetchTeachingRows(classroomIds);

  if (teachingError) {
    return NextResponse.json({ message: teachingError.message }, { status: 500 });
  }

  const teachingIds = (teachingRows ?? []).map((row) => row.id);
  const { data: assignmentRows, error: assignmentError } = teachingIds.length
    ? await fetchAssignments(teachingIds)
    : { data: [], error: null };

  if (assignmentError) {
    return NextResponse.json({ message: assignmentError.message }, { status: 500 });
  }

  const assignments = assignmentRows ?? [];
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const [{ data: scoreRows, error: scoreError }, { data: quizSettings, error: quizError }] =
    assignmentIds.length
      ? await Promise.all([
          fetchScores(caller.sub, assignmentIds),
          supabaseAdmin
            .from('quiz_settings')
            .select('assignment_id, show_score_after_submit')
            .in('assignment_id', assignmentIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];

  if (scoreError || quizError) {
    return NextResponse.json(
      { message: scoreError?.message ?? quizError?.message },
      { status: 500 }
    );
  }

  const scoreByAssignmentId = new Map((scoreRows ?? []).map((score) => [score.assignment_id, score]));
  const quizSettingByAssignmentId = new Map(
    (quizSettings ?? []).map((row) => [row.assignment_id, row])
  );
  const subjects = (teachingRows ?? []).map((teaching) => ({
    id: teaching.id,
    teacher: teaching.teacher,
    subject: teaching.subject,
    semester: teaching.semester,
    classroom: teaching.classroom,
    assignments: assignments
      .filter((assignment) => assignment.teacher_assignment_id === teaching.id)
      .map((assignment) => {
        const score = scoreByAssignmentId.get(assignment.id);
        const quizSetting = quizSettingByAssignmentId.get(assignment.id);
        const canShowScore = !quizSetting || quizSetting.show_score_after_submit;

        return {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          full_score: Number(assignment.full_score),
          due_at: assignment.due_at,
          category: assignment.category,
          created_at: assignment.created_at,
          attachments: assignment.attachments,
          score:
            !canShowScore || score?.score === null || score?.score === undefined
              ? null
              : Number(score.score),
          feedback: score?.feedback ?? null,
          status: score?.status ?? 'not_submitted',
          updated_at: score?.updated_at ?? null,
          is_interactive_quiz: !!quizSetting,
        };
      }),
  }));

  return NextResponse.json({
    generated_at: generatedAt,
    student,
    enrollments,
    subjects,
  });
}
