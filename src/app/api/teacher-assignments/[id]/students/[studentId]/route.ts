import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import {
  loadTeacherAssignment,
  canAccessTeacherAssignment,
} from 'src/lib/teacher-assignment-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string; studentId: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id, studentId } = await params;
  const teacherAssignment = await loadTeacherAssignment(id);

  if (!canAccessTeacherAssignment(caller, teacherAssignment)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const [{ data: enrollment }, { data: student }] = await Promise.all([
    supabaseAdmin
      .from('enrollments')
      .select('id, student_number')
      .eq('classroom_id', teacherAssignment!.classroom_id)
      .eq('student_id', studentId)
      .maybeSingle(),
    supabaseAdmin
      .from('app_users')
      .select('id, username, first_name, last_name, avatar_url')
      .eq('id', studentId)
      .single(),
  ]);

  if (!enrollment || !student) {
    return NextResponse.json({ message: 'ไม่พบนักเรียนคนนี้ในห้องนี้' }, { status: 404 });
  }

  const [{ data: assignments, error: assignmentsError }, { data: scores, error: scoresError }] =
    await Promise.all([
      supabaseAdmin
        .from('assignments')
        .select('id, title, full_score, category, created_at')
        .eq('teacher_assignment_id', id)
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('scores').select('*').eq('student_id', studentId),
    ]);

  if (assignmentsError || scoresError) {
    return NextResponse.json(
      { message: assignmentsError?.message ?? scoresError?.message },
      { status: 500 }
    );
  }

  const scoreByAssignmentId = new Map(scores.map((score) => [score.assignment_id, score]));

  const rows = assignments.map((assignment) => {
    const existing = scoreByAssignmentId.get(assignment.id) ?? null;

    return {
      assignment: {
        id: assignment.id,
        title: assignment.title,
        full_score: assignment.full_score,
        category: assignment.category,
      },
      score: existing
        ? { score: existing.score, feedback: existing.feedback, status: existing.status }
        : { score: null, feedback: null, status: 'not_submitted' },
    };
  });

  return NextResponse.json({
    student: { ...student, student_number: enrollment.student_number },
    rows,
  });
}
