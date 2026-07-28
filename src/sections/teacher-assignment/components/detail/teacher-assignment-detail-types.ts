export type TeacherAssignmentTab =
  | 'overview'
  | 'students'
  | 'attendance'
  | 'assignments'
  | 'scores'
  | 'schedule';

export const TEACHER_ASSIGNMENT_TABS: TeacherAssignmentTab[] = [
  'overview',
  'students',
  'attendance',
  'assignments',
  'scores',
  'schedule',
];

export const DAY_LABELS = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
