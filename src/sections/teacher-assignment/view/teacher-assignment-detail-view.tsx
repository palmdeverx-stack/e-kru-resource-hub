'use client';

import type { TeacherAssignmentTab } from '../components/detail/teacher-assignment-detail-types';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';
import { usePathname } from 'src/routes/hooks';

import { TEACHER_ASSIGNMENT_TABS } from '../components/detail/teacher-assignment-detail-types';
import { TeacherAssignmentDetailTabs } from '../components/detail/teacher-assignment-detail-tabs';
import { TeacherAssignmentDetailHeader } from '../components/detail/teacher-assignment-detail-header';

const OverviewTab = dynamic(
  () => import('../components/detail/overview-tab').then((module) => module.OverviewTab),
  { loading: TabLoading }
);
const StudentsTab = dynamic(
  () => import('../components/detail/students-tab').then((module) => module.StudentsTab),
  { loading: TabLoading }
);
const AttendanceSection = dynamic(
  () => import('../components/attendance-section').then((module) => module.AttendanceSection),
  { loading: TabLoading }
);
const AssignmentsTab = dynamic(
  () => import('../components/detail/assignments-tab').then((module) => module.AssignmentsTab),
  { loading: TabLoading }
);
const ScoresTab = dynamic(
  () => import('../components/detail/scores-tab').then((module) => module.ScoresTab),
  { loading: TabLoading }
);
const ScheduleTab = dynamic(
  () => import('../components/detail/schedule-tab').then((module) => module.ScheduleTab),
  { loading: TabLoading }
);

type Props = {
  teacherAssignmentId: string;
};

export function TeacherAssignmentDetailView({ teacherAssignmentId }: Props) {
  const pathname = usePathname();
  const [tab, setTab] = useState<TeacherAssignmentTab>('overview');
  const isTeacher = pathname.startsWith(paths.teacher.assignments);
  const assignmentNewPath = isTeacher
    ? paths.teacher.assignmentNew(teacherAssignmentId)
    : paths.admin.teacherAssignment.assignmentNew(teacherAssignmentId);
  const quizNewPath = isTeacher
    ? paths.teacher.quizNew(teacherAssignmentId)
    : paths.admin.teacherAssignment.quizNew(teacherAssignmentId);

  useEffect(() => {
    const initialTab = new URLSearchParams(window.location.search).get('tab');
    if (initialTab && TEACHER_ASSIGNMENT_TABS.includes(initialTab as TeacherAssignmentTab)) {
      setTab(initialTab as TeacherAssignmentTab);
    }
  }, []);

  const gradebookPath = useCallback(
    (assignmentId: string) =>
      isTeacher ? paths.teacher.gradebook(assignmentId) : paths.admin.gradebook(assignmentId),
    [isTeacher]
  );
  const openSchedule = useCallback(() => setTab('schedule'), []);

  return (
    <Container maxWidth={false} sx={{ px: { xs: 1.5, sm: 3 }, pb: { xs: 3, sm: 5 } }}>
      <TeacherAssignmentDetailHeader teacherAssignmentId={teacherAssignmentId} />
      <TeacherAssignmentDetailTabs
        value={tab}
        teacherAssignmentId={teacherAssignmentId}
        onChange={setTab}
      />

      <Box role="tabpanel" aria-label={tab}>
        {tab === 'overview' && (
          <OverviewTab teacherAssignmentId={teacherAssignmentId} onOpenSchedule={openSchedule} />
        )}
        {tab === 'students' && <StudentsTab teacherAssignmentId={teacherAssignmentId} />}
        {tab === 'attendance' && <AttendanceSection teacherAssignmentId={teacherAssignmentId} />}
        {tab === 'assignments' && (
          <AssignmentsTab
            teacherAssignmentId={teacherAssignmentId}
            assignmentNewPath={assignmentNewPath}
            gradebookPath={gradebookPath}
          />
        )}
        {tab === 'scores' && (
          <ScoresTab
            teacherAssignmentId={teacherAssignmentId}
            gradebookPath={gradebookPath}
            assignmentNewPath={`${assignmentNewPath}?returnTab=scores`}
            quizNewPath={`${quizNewPath}?returnTab=scores`}
          />
        )}
        {tab === 'schedule' && <ScheduleTab teacherAssignmentId={teacherAssignmentId} />}
      </Box>
    </Container>
  );
}

function TabLoading() {
  return (
    <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 3 }, borderRadius: { xs: 2, sm: 1 } }}>
      <Skeleton variant="rounded" height={220} sx={{ height: { xs: 160, sm: 220 } }} />
    </Card>
  );
}
