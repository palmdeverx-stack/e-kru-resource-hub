import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canEditGradebook } from 'src/lib/grade-review-access';
import {
  loadTeacherAssignment,
  canAccessTeacherAssignment,
} from 'src/lib/teacher-assignment-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

const VALID_STATUSES = [
  'submitted',
  'late',
  'not_submitted',
  'absent',
  'sick_leave',
  'pending_review',
] as const;

async function loadAssignmentWithAccess(id: string) {
  const { data: assignment } = await supabaseAdmin
    .from('assignments')
    .select('id, title, description, full_score, teacher_assignment_id, created_at')
    .eq('id', id)
    .single();

  if (!assignment) return null;

  const teacherAssignment = await loadTeacherAssignment(assignment.teacher_assignment_id);

  return { assignment, teacherAssignment };
}

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const loaded = await loadAssignmentWithAccess(id);

  if (!loaded || !canAccessTeacherAssignment(caller, loaded.teacherAssignment)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const classroomId = loaded.teacherAssignment!.classroom_id;

  const [{ data: roster, error: rosterError }, { data: scores, error: scoresError }] =
    await Promise.all([
      supabaseAdmin
        .from('enrollments')
        .select(
          'student_number, student:app_users(id, username, first_name, last_name, avatar_url)'
        )
        .eq('classroom_id', classroomId)
        .order('student_number'),
      supabaseAdmin.from('scores').select('*').eq('assignment_id', id),
    ]);

  if (rosterError || scoresError) {
    return NextResponse.json(
      { message: rosterError?.message ?? scoresError?.message },
      { status: 500 }
    );
  }

  const scoreByStudentId = new Map(scores.map((score) => [score.student_id, score]));

  const rows = roster.map((row) => {
    const existing = scoreByStudentId.get((row.student as any).id) ?? null;

    return {
      student: row.student,
      studentNumber: row.student_number,
      score: existing ?? { id: null, score: null, feedback: null, status: 'not_submitted' },
    };
  });

  return NextResponse.json({
    assignment: {
      ...loaded.assignment,
      subject_name: (loaded.teacherAssignment as any)?.subjects?.name ?? null,
      subject_code: (loaded.teacherAssignment as any)?.subjects?.code ?? null,
      classroom_name: (loaded.teacherAssignment as any)?.classrooms?.name ?? null,
      semester_name: (loaded.teacherAssignment as any)?.semesters?.name ?? null,
    },
    rows,
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const loaded = await loadAssignmentWithAccess(id);

  if (!loaded || !canAccessTeacherAssignment(caller, loaded.teacherAssignment)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  if (!(await canEditGradebook(loaded.assignment.teacher_assignment_id))) {
    return NextResponse.json(
      { message: 'ผลการเรียนถูกส่งตรวจแล้ว ต้องรอฝ่ายวิชาการส่งกลับแก้ไขก่อน' },
      { status: 409 }
    );
  }

  const { studentId, score, feedback, status } = await request.json();

  if (!studentId) {
    return NextResponse.json({ message: 'กรุณาเลือกนักเรียน' }, { status: 400 });
  }

  const resolvedStatus = status ?? 'submitted';

  if (!VALID_STATUSES.includes(resolvedStatus)) {
    return NextResponse.json({ message: 'สถานะไม่ถูกต้อง' }, { status: 400 });
  }

  if (score !== undefined && score !== null) {
    if (typeof score !== 'number' || score < 0 || score > loaded.assignment.full_score) {
      return NextResponse.json(
        { message: `คะแนนต้องอยู่ระหว่าง 0 ถึง ${loaded.assignment.full_score}` },
        { status: 400 }
      );
    }
  }

  const { data: enrolled } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('classroom_id', loaded.teacherAssignment!.classroom_id)
    .eq('student_id', studentId)
    .maybeSingle();

  if (!enrolled) {
    return NextResponse.json({ message: 'นักเรียนคนนี้ไม่ได้อยู่ในห้องนี้' }, { status: 404 });
  }

  const { data: saved, error } = await supabaseAdmin
    .from('scores')
    .upsert(
      {
        assignment_id: id,
        student_id: studentId,
        score: score ?? null,
        feedback: feedback || null,
        status: resolvedStatus,
        graded_by: caller.sub,
      },
      { onConflict: 'assignment_id,student_id' }
    )
    .select('*')
    .single();

  if (error || !saved) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถบันทึกคะแนนได้' },
      { status: 500 }
    );
  }

  return NextResponse.json({ score: saved });
}
