'use client';

import { StudentClassroomSection } from '../components/student-classroom-section';
import {
  HeroStat,
  HeroStats,
  StudentPageState,
  StudentPageScaffold,
  getCurrentEnrollment,
  useStudentClassroomDashboard,
} from './student-dashboard-shared';

// ----------------------------------------------------------------------

export function StudentClassroomView() {
  const { data, isLoading, isError, refetch } = useStudentClassroomDashboard();

  if (isLoading || isError || !data) {
    return <StudentPageState isLoading={isLoading} isError={isError || !data} onRetry={refetch} />;
  }

  const currentEnrollment = getCurrentEnrollment(data);
  const friendCount = data.class_members.filter((member) => !member.is_current_student).length;

  return (
    <StudentPageScaffold
      data={data}
      section="classroom"
      stats={
        <HeroStats>
          <HeroStat
            icon="solar:users-group-rounded-bold"
            label="เพื่อนร่วมชั้น"
            value={friendCount}
          />
          <HeroStat
            icon="solar:user-id-bold"
            label="ครูที่ปรึกษา"
            value={data.homeroom_teachers.length}
          />
        </HeroStats>
      }
    >
      <StudentClassroomSection
        classroom={currentEnrollment?.classroom}
        members={data.class_members}
        teachers={data.homeroom_teachers}
      />
    </StudentPageScaffold>
  );
}
