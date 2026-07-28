'use client';

import type { SubmissionStatus } from 'src/sections/gradebook/gradebook-actions';
import type { AssignmentCategory } from 'src/sections/assignment/assignment-actions';

// ----------------------------------------------------------------------

export type ScoreReport = {
  teacherAssignmentId: string;
  semesterId: string;
  schoolName: string;
  schoolLogoUrl: string | null;
  teacher: { firstName: string | null; lastName: string | null; username: string };
  subject: { name: string; code: string | null; credits: number };
  classroom: {
    id: string;
    name: string;
    gradeLevel: string | null;
    academicYear: string | null;
  };
  semesterName: string | null;
  assignments: Array<{
    id: string;
    title: string;
    category: AssignmentCategory;
    fullScore: number;
  }>;
  students: Array<{
    id: string;
    studentNumber: string | null;
    studentCode: string | null;
    nationalId: string | null;
    username: string;
    firstName: string | null;
    lastName: string | null;
    nickname: string | null;
    specialResult: 'ร' | 'มส' | 'มผ' | null;
    desirableAttributesLevel: number | null;
    readingThinkingWritingLevel: number | null;
    activityResult: 'pass' | 'fail' | 'pending' | null;
    scores: Record<string, { score: number | null; status: SubmissionStatus }>;
  }>;
};

export async function getScoreReport(teacherAssignmentId: string): Promise<ScoreReport> {
  const response = await fetch(`/api/teacher-assignments/${teacherAssignmentId}/score-report`, {});
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถสร้างรายงานคะแนนได้');
  return json.report;
}
