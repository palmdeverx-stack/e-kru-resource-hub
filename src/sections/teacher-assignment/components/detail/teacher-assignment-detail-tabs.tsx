'use client';

import type { TeacherAssignmentTab } from './teacher-assignment-detail-types';

import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';

import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';

import { RemixIcon } from 'src/components/remix-icon';

import { listAssignments } from 'src/sections/assignment/assignment-actions';

import { getRoster, getSchedules } from '../../teacher-assignment-actions';

type Props = {
  value: TeacherAssignmentTab;
  teacherAssignmentId: string;
  onChange: (value: TeacherAssignmentTab) => void;
};

export const TeacherAssignmentDetailTabs = memo(function TeacherAssignmentDetailTabs({
  value,
  teacherAssignmentId,
  onChange,
}: Props) {
  const { data: roster } = useQuery({
    queryKey: ['roster', teacherAssignmentId],
    queryFn: () => getRoster(teacherAssignmentId),
  });
  const { data: assignments } = useQuery({
    queryKey: ['assignments', teacherAssignmentId],
    queryFn: () => listAssignments(teacherAssignmentId),
  });
  const { data: schedules } = useQuery({
    queryKey: ['schedules', teacherAssignmentId],
    queryFn: () => getSchedules(teacherAssignmentId),
  });
  const workCount =
    assignments?.filter((assignment) => assignment.category === 'assignment').length ?? 0;

  return (
    <Card variant="outlined" sx={{ mb: { xs: 2, sm: 3 }, borderRadius: { xs: 2, sm: 1 } }}>
      <Tabs
        value={value}
        onChange={(_event, nextValue: TeacherAssignmentTab) => onChange(nextValue)}
        variant="scrollable"
        scrollButtons={false}
        aria-label="ส่วนข้อมูลรายวิชา"
        sx={{
          px: { xs: 0.5, sm: 2 },
          minHeight: { xs: 58, sm: 48 },
          '& .MuiTab-root': {
            gap: { xs: 0.25, sm: 1 },
            px: { xs: 1, sm: 2 },
            minWidth: { xs: 66, sm: 90 },
            minHeight: { xs: 58, sm: 48 },
            fontSize: { xs: '0.68rem', sm: '0.875rem' },
            flexDirection: { xs: 'column', sm: 'row' },
          },
          '& .MuiTab-icon': {
            width: { xs: 20, sm: 24 },
            height: { xs: 20, sm: 24 },
            mb: '0 !important',
          },
        }}
      >
        <Tab
          value="overview"
          label="ภาพรวม"
          icon={<RemixIcon icon="solar:chart-square-outline" />}
          iconPosition="start"
        />
        <Tab
          value="students"
          label={
            <>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                นร. ({roster?.roster.length ?? 0})
              </Box>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                นักเรียน ({roster?.roster.length ?? 0})
              </Box>
            </>
          }
          icon={<RemixIcon icon="solar:users-group-rounded-bold" />}
          iconPosition="start"
        />
        <Tab
          value="attendance"
          label="เช็คชื่อ"
          icon={<RemixIcon icon="solar:check-circle-bold" />}
          iconPosition="start"
        />
        <Tab
          value="assignments"
          label={`งาน (${workCount})`}
          icon={<RemixIcon icon="solar:list-bold" />}
          iconPosition="start"
        />
        <Tab
          value="scores"
          label={
            <>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                คะแนน
              </Box>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                จัดการคะแนน
              </Box>
            </>
          }
          icon={<RemixIcon icon="solar:cup-star-bold" />}
          iconPosition="start"
        />
        <Tab
          value="schedule"
          label={
            <>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                ตาราง ({schedules?.length ?? 0})
              </Box>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                ตารางสอน ({schedules?.length ?? 0})
              </Box>
            </>
          }
          icon={<RemixIcon icon="solar:calendar-date-bold" />}
          iconPosition="start"
        />
      </Tabs>
    </Card>
  );
});
