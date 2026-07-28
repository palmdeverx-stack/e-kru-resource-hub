import type { ScoreReport } from 'src/sections/teacher-assignment/score-report-actions';

// ----------------------------------------------------------------------

export function gradeFromScore(score: number) {
  if (score >= 80) return '4';
  if (score >= 75) return '3.5';
  if (score >= 70) return '3';
  if (score >= 65) return '2.5';
  if (score >= 60) return '2';
  if (score >= 55) return '1.5';
  if (score >= 50) return '1';
  return '0';
}

export function buildGradeResultRows(report: ScoreReport) {
  const totalFullScore = report.assignments.reduce((total, item) => total + item.fullScore, 0);
  return report.students.map((student) => {
    const categoryScores = Object.fromEntries(
      ['assignment', 'quiz', 'midterm', 'final', 'other'].map((category) => [
        category,
        report.assignments
          .filter((assignment) => assignment.category === category)
          .reduce(
            (total, assignment) => total + (student.scores[assignment.id]?.score ?? 0),
            0
          ),
      ])
    ) as Record<'assignment' | 'quiz' | 'midterm' | 'final' | 'other', number>;
    const total = Object.values(categoryScores).reduce((sum, score) => sum + score, 0);
    const normalized = totalFullScore ? (total / totalFullScore) * 100 : 0;
    return {
      student,
      categoryScores,
      total,
      normalized,
      grade: student.specialResult ?? gradeFromScore(normalized),
    };
  });
}
