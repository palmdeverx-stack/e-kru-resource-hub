'use client';

import { useQuery } from '@tanstack/react-query';

import { getScheduleMode } from 'src/sections/schedule-builder/schedule-settings-actions';

import { StudentWeeklyTimetable } from '../components/student-weekly-timetable';
import {
  HeroStat,
  HeroStats,
  StudentPageState,
  StudentPageScaffold,
  useStudentSubjectsDashboard,
} from './student-dashboard-shared';

// ----------------------------------------------------------------------

export function StudentTimetableView() {
  const { data: scheduleMode = 'hour' } = useQuery({
    queryKey: ['schedule-mode'],
    queryFn: getScheduleMode,
  });
  const { data, isLoading, isError, refetch } = useStudentSubjectsDashboard();

  if (isLoading || isError || !data) {
    return <StudentPageState isLoading={isLoading} isError={isError || !data} onRetry={refetch} />;
  }

  return (
    <StudentPageScaffold
      data={data}
      section="timetable"
      stats={
        <HeroStats>
          <HeroStat
            icon="solar:calendar-date-bold"
            label="คาบ/สัปดาห์"
            value={data.schedules.length}
          />
          <HeroStat
            icon="solar:notebook-bold-duotone"
            label="รายวิชา"
            value={data.subjects.length}
          />
        </HeroStats>
      }
    >
      <StudentWeeklyTimetable schedules={data.schedules} scheduleMode={scheduleMode} />
    </StudentPageScaffold>
  );
}
