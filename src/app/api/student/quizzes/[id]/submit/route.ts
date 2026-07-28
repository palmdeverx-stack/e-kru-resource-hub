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

  const body = (await request.json()) as {
    attemptId?: string;
    answers?: Record<string, string[] | string>;
  };
  if (!body.attemptId || !body.answers || typeof body.answers !== 'object') {
    return NextResponse.json({ message: 'ข้อมูลคำตอบไม่ถูกต้อง' }, { status: 400 });
  }

  const [{ data: attempt }, { data: settings }, { data: questions, error: questionError }] =
    await Promise.all([
      supabaseAdmin
        .from('quiz_attempts')
        .select('id, status, started_at')
        .eq('id', body.attemptId)
        .eq('assignment_id', id)
        .eq('student_id', caller.sub)
        .maybeSingle(),
      supabaseAdmin
        .from('quiz_settings')
        .select('time_limit_minutes, show_score_after_submit')
        .eq('assignment_id', id)
        .maybeSingle(),
      supabaseAdmin
        .from('quiz_questions')
        .select('id, points, selection_mode, options:quiz_options(id, is_correct)')
        .eq('assignment_id', id),
    ]);

  if (!attempt || attempt.status !== 'in_progress') {
    return NextResponse.json(
      { message: 'แบบทดสอบนี้ถูกส่งแล้วหรือเซสชันไม่ถูกต้อง' },
      { status: 409 }
    );
  }
  if (questionError || !settings || !questions?.length) {
    return NextResponse.json(
      { message: questionError?.message ?? 'ไม่พบคำถามในแบบทดสอบ' },
      { status: 404 }
    );
  }

  const now = Date.now();
  const dueAt = access.assignment.due_at ? new Date(access.assignment.due_at).getTime() : null;
  const timeEndsAt = settings.time_limit_minutes
    ? new Date(attempt.started_at).getTime() + settings.time_limit_minutes * 60_000
    : null;
  const gracePeriod = 30_000;
  if (
    (dueAt !== null && now > dueAt + gracePeriod) ||
    (timeEndsAt !== null && now > timeEndsAt + gracePeriod)
  ) {
    return NextResponse.json({ message: 'หมดเวลาทำแบบทดสอบแล้ว' }, { status: 409 });
  }

  const gradedAnswers: Array<{
    attempt_id: string;
    question_id: string;
    selected_option_id: string;
    is_correct: boolean;
    points_awarded: number;
  }> = [];
  let score = 0;
  for (const question of questions) {
    const submittedAnswer = body.answers[question.id];
    const selectedOptionIds = Array.isArray(submittedAnswer)
      ? submittedAnswer
      : submittedAnswer
        ? [submittedAnswer]
        : [];
    const options = (question.options ?? []) as unknown as Array<{
      id: string;
      is_correct: boolean;
    }>;
    const points = Number(question.points);
    if (!selectedOptionIds.length) continue;
    const uniqueSelectedOptionIds = [...new Set(selectedOptionIds)];
    const selectedOptions = uniqueSelectedOptionIds.map((selectedOptionId) =>
      options.find((option) => option.id === selectedOptionId)
    );
    if (
      selectedOptions.some((option) => !option) ||
      (question.selection_mode === 'single' && uniqueSelectedOptionIds.length !== 1)
    ) {
      return NextResponse.json({ message: 'พบตัวเลือกคำตอบที่ไม่ถูกต้อง' }, { status: 400 });
    }

    const correctOptionIds = options
      .filter((option) => option.is_correct)
      .map((option) => option.id);
    const isCorrect =
      uniqueSelectedOptionIds.length === correctOptionIds.length &&
      uniqueSelectedOptionIds.every((optionId) => correctOptionIds.includes(optionId));
    const awarded = isCorrect ? points : 0;
    score += awarded;

    selectedOptions.forEach((selectedOption, selectedIndex) => {
      gradedAnswers.push({
        attempt_id: attempt.id,
        question_id: question.id,
        selected_option_id: selectedOption!.id,
        is_correct: isCorrect,
        points_awarded: selectedIndex === 0 ? awarded : 0,
      });
    });
  }

  if (gradedAnswers.length) {
    const { error: answersError } = await supabaseAdmin.from('quiz_answers').insert(gradedAnswers);
    if (answersError) {
      return NextResponse.json({ message: answersError.message }, { status: 500 });
    }
  }

  const maxScore = questions.reduce((total, question) => total + Number(question.points), 0);
  const { error: scoreError } = await supabaseAdmin.from('scores').upsert(
    {
      assignment_id: id,
      student_id: caller.sub,
      score,
      feedback: null,
      status: 'submitted',
      graded_by: access.teaching.teacher_id,
    },
    { onConflict: 'assignment_id,student_id' }
  );

  if (scoreError) {
    await supabaseAdmin.from('quiz_answers').delete().eq('attempt_id', attempt.id);
    return NextResponse.json({ message: scoreError.message }, { status: 500 });
  }

  const submittedAt = new Date().toISOString();
  const { error: attemptError } = await supabaseAdmin
    .from('quiz_attempts')
    .update({ status: 'submitted', submitted_at: submittedAt, score, max_score: maxScore })
    .eq('id', attempt.id)
    .eq('status', 'in_progress');

  if (attemptError) {
    return NextResponse.json({ message: attemptError.message }, { status: 500 });
  }

  return NextResponse.json({
    result: {
      submittedAt,
      score: settings.show_score_after_submit ? score : null,
      maxScore: settings.show_score_after_submit ? maxScore : null,
      showScore: settings.show_score_after_submit,
    },
  });
}
