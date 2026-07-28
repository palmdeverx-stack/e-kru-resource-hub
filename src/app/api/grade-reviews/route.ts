import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canViewViaPermission } from 'src/lib/department-permission-access';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (
    !caller?.schoolId ||
    (!(await canViewViaPermission(caller, 'grades.review')) &&
      !(await canViewViaPermission(caller, 'grades.approve')))
  ) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตรวจสอบผลการเรียน' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('teacher_assignments')
    .select(
      `id, teacher_id,
       teacher:app_users!teacher_assignments_teacher_id_fkey(id, first_name, last_name, username),
       subject:subjects(id, code, name),
       classroom:classrooms!inner(id, name, grade_level, school_id, academic_year:academic_years(year)),
       semester:semesters(id, name),
       assignments(id, full_score, scores(id, student_id, score, status)),
       review:grade_review_submissions(
         id, status, submitted_at, reviewed_at, approved_at, note,
         submitted_by:app_users!grade_review_submissions_submitted_by_fkey(first_name, last_name),
         reviewed_by:app_users!grade_review_submissions_reviewed_by_fkey(first_name, last_name),
         approved_by:app_users!grade_review_submissions_approved_by_fkey(first_name, last_name)
       )`
    )
    .eq('classroom.school_id', caller.schoolId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const classroomIds = Array.from(
    new Set(
      (data ?? []).flatMap((item) => {
        const classroom = item.classroom as unknown as { id?: string } | null;
        return classroom?.id ? [classroom.id] : [];
      })
    )
  );
  const { data: enrollments, error: enrollmentError } = classroomIds.length
    ? await supabaseAdmin
        .from('enrollments')
        .select('classroom_id, student_id')
        .in('classroom_id', classroomIds)
    : { data: [], error: null };

  if (enrollmentError) {
    return NextResponse.json({ message: enrollmentError.message }, { status: 500 });
  }

  const rosterCount = new Map<string, number>();
  const rosterByClassroom = new Map<string, string[]>();
  (enrollments ?? []).forEach((row) => {
    rosterCount.set(row.classroom_id, (rosterCount.get(row.classroom_id) ?? 0) + 1);
    rosterByClassroom.set(row.classroom_id, [
      ...(rosterByClassroom.get(row.classroom_id) ?? []),
      row.student_id,
    ]);
  });

  const teacherAssignmentIds = (data ?? []).map((item) => item.id);
  const { data: specialResults } = teacherAssignmentIds.length
    ? await supabaseAdmin
        .from('teacher_assignment_student_results')
        .select('teacher_assignment_id, student_id')
        .in('teacher_assignment_id', teacherAssignmentIds)
        .not('special_result', 'is', null)
    : { data: [] };
  const specialByAssignment = new Map<string, Set<string>>();
  (specialResults ?? []).forEach((result) => {
    const students =
      specialByAssignment.get(result.teacher_assignment_id) ?? new Set<string>();
    students.add(result.student_id);
    specialByAssignment.set(result.teacher_assignment_id, students);
  });

  const reviews = (data ?? []).map((item) => {
    const classroom = item.classroom as unknown as { id: string } | null;
    const assignments = (item.assignments ?? []) as Array<{
      id: string;
      full_score: number | string;
      scores: Array<{
        student_id: string;
        score: number | string | null;
        status: string;
      }>;
    }>;
    const roster = rosterByClassroom.get(classroom?.id ?? '') ?? [];
    const expectedScores = roster.length * assignments.length;
    const specialStudents = specialByAssignment.get(item.id) ?? new Set<string>();
    const completedScores = roster.reduce(
      (total, studentId) =>
        total +
        (specialStudents.has(studentId)
          ? assignments.length
          : assignments.filter((assignment) =>
              (assignment.scores ?? []).some(
                (score) =>
                  score.student_id === studentId &&
                  (score.score !== null ||
                    ['absent', 'sick_leave'].includes(score.status))
              )
            ).length),
      0
    );

    return {
      ...item,
      review: Array.isArray(item.review) ? (item.review[0] ?? null) : item.review,
      assignment_count: assignments.length,
      student_count: rosterCount.get(classroom?.id ?? '') ?? 0,
      completed_scores: completedScores,
      expected_scores: expectedScores,
      total_full_score: assignments.reduce(
        (total, assignment) => total + Number(assignment.full_score),
        0
      ),
      assignments: undefined,
    };
  });

  return NextResponse.json({ reviews });
}
