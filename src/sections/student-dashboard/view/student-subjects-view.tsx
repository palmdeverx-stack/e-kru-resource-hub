'use client';

import Box from '@mui/material/Box';

import { SubjectCard } from '../components/subject-card';
import {
  HeroStat,
  EmptyCard,
  HeroStats,
  SectionHeading,
  StudentPageState,
  StudentPageScaffold,
  useStudentSubjectsDashboard,
} from './student-dashboard-shared';

export function StudentSubjectsView() {
  const { data, isLoading, isError, refetch } = useStudentSubjectsDashboard();

  if (isLoading || isError || !data) {
    return <StudentPageState isLoading={isLoading} isError={isError || !data} onRetry={refetch} />;
  }

  return (
    <StudentPageScaffold
      data={data}
      section="subjects"
      stats={
        <HeroStats>
          <HeroStat
            icon="solar:notebook-bold-duotone"
            label="วิชาเรียน"
            value={data.subjects.length}
          />
          <HeroStat
            icon="solar:calendar-date-bold"
            label="คาบ/สัปดาห์"
            value={data.schedules.length}
          />
        </HeroStats>
      }
    >
      <SectionHeading
        icon="solar:notebook-bold-duotone"
        title="วิชาที่ต้องเรียน"
        subtitle={`${data.subjects.length} รายวิชาตามห้องเรียนและภาคเรียนของคุณ`}
      />

      {data.subjects.length ? (
        <Box
          sx={{
            gap: { xs: 1.5, sm: 2, lg: 2.5 },
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'repeat(3, minmax(0, 1fr))',
              xl: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          {data.subjects.map((item) => (
            <SubjectCard key={item.id} item={item} />
          ))}
        </Box>
      ) : (
        <EmptyCard text="ยังไม่มีรายวิชาที่เปิดสอนสำหรับห้องเรียนของคุณ" />
      )}
    </StudentPageScaffold>
  );
}
