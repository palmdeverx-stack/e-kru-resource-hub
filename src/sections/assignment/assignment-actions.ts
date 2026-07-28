'use client';

// ----------------------------------------------------------------------

export type AssignmentCategory = 'assignment' | 'quiz' | 'midterm' | 'final' | 'other';

export const ASSIGNMENT_CATEGORY_META: Record<
  AssignmentCategory,
  {
    label: string;
    sectionTitle: string;
    description: string;
    singleton: boolean;
    createHeading: string;
    defaultTitle: string;
  }
> = {
  assignment: {
    label: 'งาน',
    sectionTitle: 'คะแนนจากงาน',
    description: 'คะแนนจากงานและแบบฝึกหัดที่มอบหมายให้นักเรียน',
    singleton: false,
    createHeading: 'สร้างงาน',
    defaultTitle: '',
  },
  quiz: {
    label: 'แบบทดสอบ',
    sectionTitle: 'คะแนนจากแบบทดสอบ',
    description: 'คะแนนจากแบบทดสอบย่อยระหว่างเรียน',
    singleton: false,
    createHeading: 'สร้างแบบทดสอบ',
    defaultTitle: '',
  },
  midterm: {
    label: 'สอบกลางภาค',
    sectionTitle: 'คะแนนสอบกลางภาค',
    description: 'คะแนนสอบกลางภาค กรอกคะแนนเดียวต่อนักเรียนหนึ่งคน',
    singleton: true,
    createHeading: 'เพิ่มคะแนนสอบกลางภาค',
    defaultTitle: 'สอบกลางภาค',
  },
  final: {
    label: 'สอบปลายภาค',
    sectionTitle: 'คะแนนสอบปลายภาค',
    description: 'คะแนนสอบปลายภาค กรอกคะแนนเดียวต่อนักเรียนหนึ่งคน',
    singleton: true,
    createHeading: 'เพิ่มคะแนนสอบปลายภาค',
    defaultTitle: 'สอบปลายภาค',
  },
  other: {
    label: 'อื่นๆ',
    sectionTitle: 'คะแนนอื่นๆ',
    description: 'คะแนนกิจกรรม จิตพิสัย หรือการช่วยงาน',
    singleton: false,
    createHeading: 'เพิ่มคะแนนอื่นๆ',
    defaultTitle: '',
  },
};

export type Assignment = {
  id: string;
  title: string;
  description: string | null;
  full_score: number;
  due_at: string | null;
  category: AssignmentCategory;
  created_at: string;
  attachments: Array<{
    id: string;
    file_name: string;
    file_url: string;
    mime_type: string;
    file_size: number;
    created_at: string;
  }>;
};

export type CreateAssignmentParams = {
  title: string;
  description?: string;
  fullScore?: number;
  dueAt?: string | null;
  category?: AssignmentCategory;
  files?: File[];
  quiz?: {
    timeLimitMinutes: number | null;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showScoreAfterSubmit: boolean;
    questions: Array<{
      prompt: string;
      points: number;
      selectionMode: 'single' | 'multiple';
      correctOptionIndexes: number[];
      options: string[];
    }>;
  };
};

export type UpdateAssignmentParams = {
  title: string;
  description?: string;
  fullScore: number;
};

export async function listAssignments(teacherAssignmentId: string): Promise<Assignment[]> {
  const response = await fetch(`/api/teacher-assignments/${teacherAssignmentId}/assignments`, {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load assignments');

  return json.assignments;
}

export async function createAssignment(
  teacherAssignmentId: string,
  params: CreateAssignmentParams
): Promise<Assignment> {
  const formData = new FormData();
  formData.append('title', params.title);
  formData.append('description', params.description ?? '');
  formData.append('fullScore', String(params.fullScore ?? 100));
  formData.append('dueAt', params.dueAt ?? '');
  formData.append('category', params.category ?? 'assignment');
  if (params.quiz) formData.append('quiz', JSON.stringify(params.quiz));
  params.files?.forEach((file) => formData.append('files', file));

  const response = await fetch(`/api/teacher-assignments/${teacherAssignmentId}/assignments`, {
    method: 'POST',
    body: formData,
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to create assignment');

  return json.assignment;
}

export async function updateAssignment(
  assignmentId: string,
  params: UpdateAssignmentParams
): Promise<Assignment> {
  const response = await fetch(`/api/assignments/${assignmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to update assignment');

  return json.assignment;
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
  const response = await fetch(`/api/assignments/${assignmentId}`, {
    method: 'DELETE',
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to delete assignment');
}
