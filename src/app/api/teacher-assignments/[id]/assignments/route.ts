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

const BUCKET = 'assignment-attachments';
const MAX_FILES = 8;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
];
const FILE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/zip': 'zip',
};
const VALID_CATEGORIES = ['assignment', 'quiz', 'midterm', 'final', 'other'];
const SINGLETON_CATEGORIES = ['midterm', 'final'];
const SINGLETON_CATEGORY_LABELS: Record<string, string> = {
  midterm: 'คะแนนสอบกลางภาค',
  final: 'คะแนนสอบปลายภาค',
};
const MAX_QUIZ_QUESTIONS = 100;
const MAX_QUIZ_OPTIONS = 8;

type QuizInput = {
  timeLimitMinutes?: number | null;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showScoreAfterSubmit?: boolean;
  questions?: Array<{
    prompt?: string;
    points?: number;
    selectionMode?: 'single' | 'multiple';
    correctOptionIndexes?: number[];
    options?: string[];
  }>;
};

function parseQuizInput(value: FormDataEntryValue | null): QuizInput | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return JSON.parse(value) as QuizInput;
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const teacherAssignment = await loadTeacherAssignment(id);

  if (!canAccessTeacherAssignment(caller, teacherAssignment)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('assignments')
    .select(
      `id, title, description, full_score, due_at, category, created_at,
       attachments:assignment_attachments(id, file_name, file_url, mime_type, file_size, created_at)`
    )
    .eq('teacher_assignment_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ assignments: data });
}

export async function POST(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const teacherAssignment = await loadTeacherAssignment(id);

  if (!canAccessTeacherAssignment(caller, teacherAssignment)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  if (!(await canEditGradebook(id))) {
    return NextResponse.json(
      { message: 'ผลการเรียนถูกส่งตรวจแล้ว ต้องรอฝ่ายวิชาการส่งกลับแก้ไขก่อน' },
      { status: 409 }
    );
  }

  const isMultipart = request.headers.get('content-type')?.includes('multipart/form-data');
  const body = isMultipart ? await request.formData() : await request.json();
  const title = isMultipart ? body.get('title') : body.title;
  const description = isMultipart ? body.get('description') : body.description;
  const fullScore = isMultipart ? body.get('fullScore') : body.fullScore;
  const dueAt = isMultipart ? body.get('dueAt') : body.dueAt;
  const category = isMultipart ? body.get('category') : body.category;
  const quiz = isMultipart
    ? parseQuizInput(body.get('quiz'))
    : (body.quiz as QuizInput | undefined);
  const files = isMultipart
    ? body
        .getAll('files')
        .filter((file: FormDataEntryValue): file is File => file instanceof File && file.size > 0)
    : [];

  const normalizedTitle = typeof title === 'string' ? title.trim() : '';
  const normalizedDescription = typeof description === 'string' ? description.trim() : '';

  if (!normalizedTitle || normalizedTitle.length > 200) {
    return NextResponse.json({ message: 'กรุณากรอกชื่องาน' }, { status: 400 });
  }
  if (normalizedDescription.length > 5000) {
    return NextResponse.json({ message: 'รายละเอียดต้องไม่เกิน 5,000 ตัวอักษร' }, { status: 400 });
  }

  const normalizedCategory = typeof category === 'string' && category ? category : 'assignment';
  if (!VALID_CATEGORIES.includes(normalizedCategory)) {
    return NextResponse.json({ message: 'หมวดหมู่คะแนนไม่ถูกต้อง' }, { status: 400 });
  }

  if (normalizedCategory === 'quiz') {
    if (!quiz || !Array.isArray(quiz.questions) || !quiz.questions.length) {
      return NextResponse.json({ message: 'กรุณาเพิ่มคำถามอย่างน้อย 1 ข้อ' }, { status: 400 });
    }
    if (quiz.questions.length > MAX_QUIZ_QUESTIONS) {
      return NextResponse.json(
        { message: `แบบทดสอบมีได้สูงสุด ${MAX_QUIZ_QUESTIONS} ข้อ` },
        { status: 400 }
      );
    }
    const invalidQuestion = quiz.questions.find((question) => {
      const options = question.options ?? [];
      const selectionMode = question.selectionMode ?? 'single';
      const correctOptionIndexes = question.correctOptionIndexes ?? [];
      return (
        !question.prompt?.trim() ||
        question.prompt.trim().length > 2000 ||
        !Number.isFinite(Number(question.points)) ||
        Number(question.points) <= 0 ||
        options.length < 2 ||
        options.length > MAX_QUIZ_OPTIONS ||
        options.some((option) => !option.trim() || option.trim().length > 1000) ||
        !['single', 'multiple'].includes(selectionMode) ||
        !correctOptionIndexes.length ||
        (selectionMode === 'single' && correctOptionIndexes.length !== 1) ||
        new Set(correctOptionIndexes).size !== correctOptionIndexes.length ||
        correctOptionIndexes.some(
          (optionIndex) =>
            !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length
        )
      );
    });
    if (invalidQuestion) {
      return NextResponse.json(
        { message: 'กรุณากรอกคำถาม ตัวเลือก คำตอบ และคะแนนให้ครบถ้วน' },
        { status: 400 }
      );
    }
    const timeLimit = quiz.timeLimitMinutes;
    if (
      timeLimit !== null &&
      timeLimit !== undefined &&
      (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 300)
    ) {
      return NextResponse.json(
        { message: 'เวลาทำแบบทดสอบต้องอยู่ระหว่าง 1–300 นาที' },
        { status: 400 }
      );
    }
  }

  if (SINGLETON_CATEGORIES.includes(normalizedCategory)) {
    const { data: existing } = await supabaseAdmin
      .from('assignments')
      .select('id')
      .eq('teacher_assignment_id', id)
      .eq('category', normalizedCategory)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          message: `มี${SINGLETON_CATEGORY_LABELS[normalizedCategory]}อยู่แล้ว กรุณาแก้ไขรายการเดิมแทน`,
        },
        { status: 409 }
      );
    }
  }

  const parsedFullScore =
    normalizedCategory === 'quiz' && quiz
      ? quiz.questions!.reduce((total, question) => total + Number(question.points), 0)
      : fullScore !== undefined
        ? Number(fullScore)
        : 100;

  if (!Number.isFinite(parsedFullScore) || parsedFullScore <= 0) {
    return NextResponse.json({ message: 'คะแนนเต็มต้องมากกว่า 0' }, { status: 400 });
  }

  const parsedDueAt = typeof dueAt === 'string' && dueAt.trim() ? new Date(dueAt) : null;
  if (parsedDueAt && Number.isNaN(parsedDueAt.getTime())) {
    return NextResponse.json({ message: 'วันและเวลาครบกำหนดส่งไม่ถูกต้อง' }, { status: 400 });
  }
  if (parsedDueAt && parsedDueAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { message: 'วันและเวลาครบกำหนดส่งต้องเป็นเวลาในอนาคต' },
      { status: 400 }
    );
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json({ message: `แนบไฟล์ได้สูงสุด ${MAX_FILES} ไฟล์` }, { status: 400 });
  }
  const invalidFile = files.find(
    (file: File) => !ALLOWED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE
  );
  if (invalidFile) {
    return NextResponse.json(
      { message: `ไฟล์ “${invalidFile.name}” ไม่รองรับหรือมีขนาดเกิน 10MB` },
      { status: 400 }
    );
  }

  const { data: assignment, error } = await supabaseAdmin
    .from('assignments')
    .insert({
      teacher_assignment_id: id,
      title: normalizedTitle,
      description: normalizedDescription || null,
      full_score: parsedFullScore,
      due_at: parsedDueAt?.toISOString() ?? null,
      category: normalizedCategory,
    })
    .select('id, title, description, full_score, due_at, category, created_at')
    .single();

  if (error || !assignment) {
    if (error?.code === '23505') {
      return NextResponse.json(
        {
          message: `มี${SINGLETON_CATEGORY_LABELS[normalizedCategory] ?? 'รายการนี้'}อยู่แล้ว กรุณาแก้ไขรายการเดิมแทน`,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถสร้างงานได้' },
      { status: 500 }
    );
  }

  if (files.length) {
    const uploadedPaths: string[] = [];

    try {
      const attachments = [];
      for (const file of files) {
        const extension = FILE_EXTENSIONS[file.type];
        const classroom = teacherAssignment!.classrooms as unknown as { school_id: string };
        const storagePath = `${classroom.school_id}/${assignment.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(storagePath, file, { contentType: file.type });
        if (uploadError) throw new Error(uploadError.message);

        uploadedPaths.push(storagePath);
        const {
          data: { publicUrl },
        } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
        attachments.push({
          assignment_id: assignment.id,
          file_name: file.name,
          file_url: publicUrl,
          storage_path: storagePath,
          mime_type: file.type,
          file_size: file.size,
        });
      }

      const { error: attachmentError } = await supabaseAdmin
        .from('assignment_attachments')
        .insert(attachments);
      if (attachmentError) throw new Error(attachmentError.message);
    } catch (attachmentError) {
      if (uploadedPaths.length) await supabaseAdmin.storage.from(BUCKET).remove(uploadedPaths);
      await supabaseAdmin.from('assignments').delete().eq('id', assignment.id);
      return NextResponse.json(
        {
          message:
            attachmentError instanceof Error
              ? attachmentError.message
              : 'ไม่สามารถอัปโหลดไฟล์แนบได้',
        },
        { status: 500 }
      );
    }
  }

  if (normalizedCategory === 'quiz' && quiz) {
    try {
      const { error: settingsError } = await supabaseAdmin.from('quiz_settings').insert({
        assignment_id: assignment.id,
        time_limit_minutes: quiz.timeLimitMinutes ?? null,
        shuffle_questions: quiz.shuffleQuestions ?? false,
        shuffle_options: quiz.shuffleOptions ?? false,
        show_score_after_submit: quiz.showScoreAfterSubmit ?? true,
      });
      if (settingsError) throw new Error(settingsError.message);

      for (const [questionIndex, question] of quiz.questions!.entries()) {
        const { data: createdQuestion, error: questionError } = await supabaseAdmin
          .from('quiz_questions')
          .insert({
            assignment_id: assignment.id,
            prompt: question.prompt!.trim(),
            points: Number(question.points),
            position: questionIndex,
            selection_mode: question.selectionMode ?? 'single',
          })
          .select('id')
          .single();
        if (questionError || !createdQuestion) {
          throw new Error(questionError?.message ?? 'ไม่สามารถบันทึกคำถามได้');
        }

        const { error: optionsError } = await supabaseAdmin.from('quiz_options').insert(
          question.options!.map((option, optionIndex) => ({
            question_id: createdQuestion.id,
            label: option.trim(),
            position: optionIndex,
            is_correct: question.correctOptionIndexes!.includes(optionIndex),
          }))
        );
        if (optionsError) throw new Error(optionsError.message);
      }
    } catch (quizError) {
      await supabaseAdmin.from('assignments').delete().eq('id', assignment.id);
      return NextResponse.json(
        {
          message: quizError instanceof Error ? quizError.message : 'ไม่สามารถสร้างแบบทดสอบได้',
        },
        { status: 500 }
      );
    }
  }

  const { data: createdAssignment } = await supabaseAdmin
    .from('assignments')
    .select(
      `id, title, description, full_score, due_at, category, created_at,
       attachments:assignment_attachments(id, file_name, file_url, mime_type, file_size, created_at)`
    )
    .eq('id', assignment.id)
    .single();

  return NextResponse.json({ assignment: createdAssignment ?? assignment }, { status: 201 });
}
