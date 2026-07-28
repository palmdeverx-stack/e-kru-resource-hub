'use client';

// ----------------------------------------------------------------------

export type GradeReviewStatus =
  | 'draft'
  | 'submitted'
  | 'revision'
  | 'reviewed'
  | 'approved'
  | 'locked';

type Person = { first_name: string | null; last_name: string | null } | null;

export type GradeReviewSubmission = {
  id: string;
  status: GradeReviewStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  note: string | null;
  submitted_by: Person;
  reviewed_by: Person;
  approved_by: Person;
  events?: Array<{
    id: string;
    status: GradeReviewStatus;
    note: string | null;
    created_at: string;
    acted_by: Person;
  }>;
};

export type GradeReviewListItem = {
  id: string;
  teacher_id: string;
  teacher: Person & { id: string; username: string };
  subject: { id: string; code: string | null; name: string } | null;
  classroom: {
    id: string;
    name: string;
    grade_level: string | null;
    academic_year: { year: string } | null;
  } | null;
  semester: { id: string; name: string } | null;
  review: GradeReviewSubmission | null;
  assignment_count: number;
  student_count: number;
  completed_scores: number;
  expected_scores: number;
  total_full_score: number;
};

export async function listGradeReviews(): Promise<GradeReviewListItem[]> {
  const response = await fetch('/api/grade-reviews');
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดรายการผลการเรียนได้');
  return json.reviews;
}

export async function getGradeReviewSubmission(
  teacherAssignmentId: string
): Promise<GradeReviewSubmission | null> {
  const response = await fetch(`/api/grade-reviews/${teacherAssignmentId}`);
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดสถานะการส่งคะแนนได้');
  return json.submission;
}

export async function updateGradeReview(
  teacherAssignmentId: string,
  action: 'submit' | 'revision' | 'review' | 'approve' | 'lock',
  note?: string
): Promise<GradeReviewSubmission> {
  const response = await fetch(`/api/grade-reviews/${teacherAssignmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, note }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถบันทึกสถานะได้');
  return json.submission;
}

export type StudentAssessmentInput = {
  studentId: string;
  specialResult: 'ร' | 'มส' | 'มผ' | null;
  desirableAttributesLevel: number | null;
  readingThinkingWritingLevel: number | null;
  activityResult: 'pass' | 'fail' | 'pending' | null;
};

export async function updateStudentAssessment(
  teacherAssignmentId: string,
  input: StudentAssessmentInput
): Promise<void> {
  const response = await fetch(
    `/api/grade-reviews/${teacherAssignmentId}/student-assessments`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  );
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถบันทึกผลประเมินได้');
}

export type GradeLineDeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'skipped';

export type GradeLineDeliveryResult = {
  counts: {
    total: number;
    pending: number;
    sent: number;
    failed: number;
    skipped: number;
  };
  eligibleStudents: number;
  linkedStudents: number;
  subjectCount: number;
  recipients: Array<{
    studentId: string;
    studentName: string;
    studentCode: string | null;
    guardianName: string | null;
    lineConnected: boolean;
  }>;
  deliveries: Array<{
    id: string;
    status: GradeLineDeliveryStatus;
    attempts: number;
    error: string | null;
    sentAt: string | null;
    createdAt: string;
    guardianName: string;
    studentName: string;
    studentCode: string | null;
  }>;
};

export async function getGradeLineDeliveries(
  teacherAssignmentId: string
): Promise<GradeLineDeliveryResult> {
  const response = await fetch(`/api/grade-reviews/${teacherAssignmentId}/line-deliveries`);
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดประวัติการส่ง LINE ได้');
  return json;
}

export async function sendGradeResultsToLine(
  teacherAssignmentId: string,
  studentIds?: string[]
): Promise<GradeLineDeliveryResult> {
  const response = await fetch(`/api/grade-reviews/${teacherAssignmentId}/line-deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentIds }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถส่งผลการเรียนทาง LINE ได้');
  return json;
}
