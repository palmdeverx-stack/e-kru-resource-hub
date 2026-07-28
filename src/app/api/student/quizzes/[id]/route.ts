import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { loadStudentQuizAccess } from 'src/lib/student-quiz-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['student']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const access = await loadStudentQuizAccess(caller, id);
  if (!access) {
    return NextResponse.json({ message: 'ไม่พบแบบทดสอบหรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });
  }

  const [{ data: settings }, { data: questions, error }, { data: attempt }] = await Promise.all([
    supabaseAdmin
      .from('quiz_settings')
      .select('time_limit_minutes, shuffle_questions, shuffle_options, show_score_after_submit')
      .eq('assignment_id', id)
      .maybeSingle(),
    supabaseAdmin
      .from('quiz_questions')
      .select(
        'id, prompt, points, position, selection_mode, options:quiz_options(id, label, position)'
      )
      .eq('assignment_id', id)
      .order('position'),
    supabaseAdmin
      .from('quiz_attempts')
      .select('id, status, started_at, submitted_at, score, max_score')
      .eq('assignment_id', id)
      .eq('student_id', caller.sub)
      .maybeSingle(),
  ]);

  if (error || !settings || !questions?.length) {
    return NextResponse.json(
      { message: error?.message ?? 'แบบทดสอบนี้ยังไม่มีคำถาม' },
      { status: 404 }
    );
  }

  const normalizedQuestions = questions.map((question) => ({
    ...question,
    points: Number(question.points),
    options: [
      ...((question.options as unknown as Array<{
        id: string;
        label: string;
        position: number;
      }>) ?? []),
    ].sort((a, b) => a.position - b.position),
  }));

  if (attempt?.status !== 'submitted') {
    if (settings.shuffle_questions) {
      normalizedQuestions.sort(
        (a, b) =>
          deterministicOrder(`${caller.sub}:${a.id}`) - deterministicOrder(`${caller.sub}:${b.id}`)
      );
    }
    if (settings.shuffle_options) {
      normalizedQuestions.forEach((question) => {
        question.options.sort(
          (a, b) =>
            deterministicOrder(`${caller.sub}:${question.id}:${a.id}`) -
            deterministicOrder(`${caller.sub}:${question.id}:${b.id}`)
        );
      });
    }
  }

  return NextResponse.json({
    quiz: {
      ...access.assignment,
      full_score: Number(access.assignment.full_score),
      subject: access.subject,
      classroom: { id: access.classroom.id, name: access.classroom.name },
      settings,
      questions: attempt?.status === 'submitted' ? [] : normalizedQuestions,
      attempt: attempt
        ? {
            ...attempt,
            score:
              settings.show_score_after_submit && attempt.score !== null
                ? Number(attempt.score)
                : null,
            max_score:
              settings.show_score_after_submit && attempt.max_score !== null
                ? Number(attempt.max_score)
                : null,
          }
        : null,
    },
  });
}

function deterministicOrder(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2147483647;
  }
  return hash;
}
