'use client';

// ----------------------------------------------------------------------

export type SubmissionStatus =
  | 'submitted'
  | 'late'
  | 'not_submitted'
  | 'absent'
  | 'sick_leave'
  | 'pending_review';

export type ScoreEntry = {
  id: string | null;
  score: number | null;
  feedback: string | null;
  status: SubmissionStatus;
};

export type GradebookRow = {
  student: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  studentNumber: string | null;
  score: ScoreEntry;
};

export type Gradebook = {
  assignment: {
    id: string;
    teacher_assignment_id: string;
    title: string;
    description: string | null;
    full_score: number;
    created_at: string;
    subject_name: string | null;
    subject_code: string | null;
    classroom_name: string | null;
    semester_name: string | null;
  };
  rows: GradebookRow[];
};

export type SaveScoreParams = {
  studentId: string;
  score?: number | null;
  feedback?: string;
  status?: SubmissionStatus;
};

export async function getGradebook(assignmentId: string): Promise<Gradebook> {
  const response = await fetch(`/api/assignments/${assignmentId}/scores`, {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load gradebook');

  return json;
}

export async function saveScore(assignmentId: string, params: SaveScoreParams) {
  const response = await fetch(`/api/assignments/${assignmentId}/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to save score');

  return json.score;
}
