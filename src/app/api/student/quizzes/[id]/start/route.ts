import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canEditGradebook } from 'src/lib/grade-review-access';
import { loadStudentQuizAccess } from 'src/lib/student-quiz-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['student']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const access = await loadStudentQuizAccess(caller, id);
  if (!access) {
    return NextResponse.json({ message: 'ไม่พบแบบทดสอบหรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });
  }
  if (!(await canEditGradebook(access.assignment.teacher_assignment_id))) {
    return NextResponse.json({ message: 'รายวิชานี้ส่งผลการเรียนแล้ว' }, { status: 409 });
  }
  if (access.assignment.due_at && new Date(access.assignment.due_at).getTime() < Date.now()) {
    return NextResponse.json({ message: 'แบบทดสอบหมดเวลาส่งแล้ว' }, { status: 409 });
  }

  const { data: existing } = await supabaseAdmin
    .from('quiz_attempts')
    .select('id, status, started_at, submitted_at, score, max_score')
    .eq('assignment_id', id)
    .eq('student_id', caller.sub)
    .maybeSingle();

  if (existing) return NextResponse.json({ attempt: existing });

  const { data: attempt, error } = await supabaseAdmin
    .from('quiz_attempts')
    .insert({ assignment_id: id, student_id: caller.sub })
    .select('id, status, started_at, submitted_at, score, max_score')
    .single();

  if (error || !attempt) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถเริ่มทำแบบทดสอบได้' },
      { status: 500 }
    );
  }

  return NextResponse.json({ attempt }, { status: 201 });
}
