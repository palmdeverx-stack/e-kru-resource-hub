'use client';

// ----------------------------------------------------------------------

// Learning areas and subject types are now school-managed master data — see
// `src/sections/subject-master`. These stay as plain strings holding the
// master item's stable `code`.
export type LearningArea = string;
export type SubjectType = string;

export type SubjectStatus = 'draft' | 'published';

/** Code of the system-seeded "กิจกรรมพัฒนาผู้เรียน" learning area master item. */
export const STUDENT_DEVELOPMENT_ACTIVITY_CODE = 'student_development_activity';

export type ActivityType = 'guidance' | 'scout_cadet' | 'club' | 'social_service';

export const ACTIVITY_TYPES: Array<{ value: ActivityType; label: string }> = [
  { value: 'guidance', label: 'กิจกรรมแนะแนว' },
  { value: 'scout_cadet', label: 'ลูกเสือ/เนตรนารี หรือนักศึกษาวิชาทหาร' },
  { value: 'club', label: 'ชุมนุม' },
  { value: 'social_service', label: 'กิจกรรมเพื่อสังคมและสาธารณประโยชน์' },
];

export const GRADE_LEVELS = [
  'ป.1',
  'ป.2',
  'ป.3',
  'ป.4',
  'ป.5',
  'ป.6',
  'ม.1',
  'ม.2',
  'ม.3',
  'ม.4',
  'ม.5',
  'ม.6',
] as const;

export type GradeLevel = (typeof GRADE_LEVELS)[number];

export function activityTypeLabel(value: ActivityType | null) {
  return ACTIVITY_TYPES.find((item) => item.value === value)?.label ?? null;
}

export type Subject = {
  id: string;
  code: string | null;
  name: string;
  name_en: string | null;
  credits: number;
  study_hours: number;
  description: string | null;
  description_en: string | null;
  image_url: string | null;
  academic_year_id: string | null;
  semester_id: string | null;
  academic_years: { year: string } | null;
  semesters: { name: string } | null;
  learning_area: LearningArea | null;
  activity_type: ActivityType | null;
  subject_type: SubjectType | null;
  education_stage: string | null;
  grade_levels: string[];
  learning_standards: string | null;
  learning_outcomes: string | null;
  learning_units: string | null;
  indicators: string | null;
  status: SubjectStatus;
  created_by: string | null;
  created_at: string;
};

export type SaveSubjectParams = {
  code?: string;
  name: string;
  nameEn?: string;
  credits: number;
  studyHours: number;
  description?: string;
  descriptionEn?: string;
  academicYearId: string;
  semesterId: string;
  status?: SubjectStatus;
  learningArea?: LearningArea;
  activityType?: ActivityType;
  subjectType?: SubjectType;
  educationStage?: string;
  gradeLevels?: string[];
  learningStandards?: string;
  learningOutcomes?: string;
  learningUnits?: string;
  indicators?: string;
};

export async function listSubjects(filters?: {
  academicYearId?: string;
  semesterId?: string;
}): Promise<Subject[]> {
  const params = new URLSearchParams();
  if (filters?.academicYearId) params.set('academicYearId', filters.academicYearId);
  if (filters?.semesterId) params.set('semesterId', filters.semesterId);
  const query = params.size ? `?${params.toString()}` : '';
  const response = await fetch(`/api/subjects${query}`, {});
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to load subjects');

  return json.subjects;
}

export async function createSubject(params: SaveSubjectParams): Promise<Subject> {
  const response = await fetch('/api/subjects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to create subject');

  return json.subject;
}

export async function getSubject(id: string): Promise<Subject> {
  const response = await fetch(`/api/subjects/${id}`);
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดข้อมูลรายวิชาได้');

  return json.subject;
}

export async function updateSubject(id: string, params: SaveSubjectParams): Promise<Subject> {
  const response = await fetch(`/api/subjects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to update subject');

  return json.subject;
}

export async function uploadSubjectImage(id: string, file: File): Promise<Subject> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/api/subjects/${id}/image`, {
    method: 'POST',
    body: formData,
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to upload subject image');

  return json.subject;
}

export async function removeSubjectImage(id: string): Promise<Subject> {
  const response = await fetch(`/api/subjects/${id}/image`, {
    method: 'DELETE',
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to remove subject image');

  return json.subject;
}

export async function deleteSubject(id: string): Promise<void> {
  const response = await fetch(`/api/subjects/${id}`, {
    method: 'DELETE',
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json.message ?? 'Failed to delete subject');
}
