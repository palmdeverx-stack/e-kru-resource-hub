'use client';

import { useMemo } from 'react';
import { Grid } from 'node_modules/@mui/material/esm';

import { StudentAssignmentList } from '../components/student-assignment-list';
import { StudentSubmissionOverview } from '../components/student-submission-overview';
import {
  HeroStat,
  HeroStats,
  isSubmitted,
  SectionHeading,
  StudentPageState,
  StudentPageScaffold,
  useStudentAssignmentsDashboard,
} from './student-dashboard-shared';

// ----------------------------------------------------------------------

export function StudentAssignmentsView() {
  const { data, isLoading, isError, refetch } = useStudentAssignmentsDashboard();

  const overview = useMemo(() => {
    const assignments =
      data?.subjects.flatMap((item) =>
        item.assignments
          .filter(
            (assignment) =>
              assignment.category === 'assignment' ||
              (assignment.category === 'quiz' && assignment.is_interactive_quiz)
          )
          .map((assignment) => ({ ...assignment, subject: item.subject }))
      ) ?? [];
    const submitted = assignments.filter((assignment) => isSubmitted(assignment.status)).length;
    const totalScore = assignments.reduce(
      (total, assignment) => total + (assignment.score ?? 0),
      0
    );
    const totalFullScore = assignments
      .filter((assignment) => assignment.score !== null)
      .reduce((total, assignment) => total + assignment.full_score, 0);

    return {
      assignments,
      submitted,
      pending: assignments.length - submitted,
      progress: assignments.length ? (submitted / assignments.length) * 100 : 0,
      scorePercent: totalFullScore ? (totalScore / totalFullScore) * 100 : 0,
    };
  }, [data]);

  if (isLoading || isError || !data) {
    return <StudentPageState isLoading={isLoading} isError={isError || !data} onRetry={refetch} />;
  }

  return (
    <StudentPageScaffold
      data={data}
      section="assignments"
      stats={
        <HeroStats>
          <HeroStat icon="solar:list-bold" label="งานทั้งหมด" value={overview.assignments.length} />
          <HeroStat icon="solar:check-circle-bold" label="ส่งแล้ว" value={overview.submitted} />
          <HeroStat icon="solar:clock-circle-bold" label="ยังไม่ส่ง" value={overview.pending} />
        </HeroStats>
      }
    >
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 3 }}>
          <StudentSubmissionOverview
            total={overview.assignments.length}
            submitted={overview.submitted}
            pending={overview.pending}
            progress={overview.progress}
            scorePercent={overview.scorePercent}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 9 }}>
          <SectionHeading
            icon="solar:list-bold"
            title="งานและแบบทดสอบ"
            subtitle="ค้นหา ติดตามการส่งงาน และเข้าสู่แบบทดสอบของแต่ละรายวิชา"
          />
          <StudentAssignmentList
            assignments={overview.assignments}
            generatedAt={data.generated_at}
          />
        </Grid>
      </Grid>
    </StudentPageScaffold>
  );
}
