'use client';

import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { RemixIcon } from 'src/components/remix-icon';

import { listAssignments } from 'src/sections/assignment/assignment-actions';

import { DAY_LABELS } from './teacher-assignment-detail-types';
import { getRoster, getSchedules } from '../../teacher-assignment-actions';

type Props = {
  teacherAssignmentId: string;
  onOpenSchedule: () => void;
};

export const OverviewTab = memo(function OverviewTab({
  teacherAssignmentId,
  onOpenSchedule,
}: Props) {
  const { data: roster, isLoading: rosterLoading } = useQuery({
    queryKey: ['roster', teacherAssignmentId],
    queryFn: () => getRoster(teacherAssignmentId),
  });
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['assignments', teacherAssignmentId],
    queryFn: () => listAssignments(teacherAssignmentId),
  });
  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules', teacherAssignmentId],
    queryFn: () => getSchedules(teacherAssignmentId),
  });

  const workCount =
    assignments?.filter((assignment) => assignment.category === 'assignment').length ?? 0;
  const teacherName = roster?.teacher
    ? `${roster.teacher.first_name ?? ''} ${roster.teacher.last_name ?? ''}`.trim() ||
      roster.teacher.username
    : '-';

  return (
    <Box sx={{ gap: { xs: 1.5, sm: 3 }, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          gap: { xs: 0.75, sm: 2 },
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        }}
      >
        <OverviewCard
          label="นักเรียนในห้อง"
          value={rosterLoading ? null : (roster?.roster.length ?? 0)}
          suffix="คน"
          icon="solar:users-group-rounded-bold"
          color="primary.main"
          bgcolor="primary.lighter"
        />
        <OverviewCard
          label="งานทั้งหมด"
          value={assignmentsLoading ? null : workCount}
          suffix="งาน"
          icon="solar:list-bold"
          color="secondary.dark"
          bgcolor="secondary.lighter"
        />
        <OverviewCard
          label="คาบเรียนต่อสัปดาห์"
          value={schedulesLoading ? null : (schedules?.length ?? 0)}
          suffix="คาบ"
          icon="solar:calendar-date-bold"
          color="warning.main"
          bgcolor="warning.lighter"
        />
      </Box>

      <Box
        sx={{
          gap: { xs: 1.5, sm: 3 },
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
        }}
      >
        <Card variant="outlined">
          <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
            <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}>
              ข้อมูลการสอน
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              รายละเอียดสำคัญของรายวิชานี้
            </Typography>
          </Box>
          <Divider />
          <Box
            sx={{
              p: { xs: 1.5, sm: 2.5 },
              gap: { xs: 1.25, sm: 2 },
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
            }}
          >
            <InfoItem label="ครูผู้สอน" value={teacherName} />
            <InfoItem label="ห้องเรียน" value={roster?.classroomName ?? '-'} />
            <InfoItem label="ภาคเรียน" value={roster?.semesterName ?? '-'} />
            <InfoItem label="หน่วยกิต" value={`${roster?.credits ?? 0} หน่วยกิต`} />
          </Box>
        </Card>

        <Card variant="outlined">
          <Box
            sx={{
              p: { xs: 1.5, sm: 2.5 },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}>
                ตารางสอนใกล้เคียง
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                คาบเรียนประจำสัปดาห์
              </Typography>
            </Box>
            <Button size="small" onClick={onOpenSchedule}>
              จัดการ
            </Button>
          </Box>
          <Divider />
          <Box
            sx={{
              p: { xs: 1.5, sm: 2.5 },
              gap: 1.25,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {schedulesLoading && <Skeleton height={76} />}
            {!schedulesLoading && !schedules?.length && (
              <Typography
                variant="body2"
                sx={{ py: 2, textAlign: 'center', color: 'text.secondary' }}
              >
                ยังไม่มีตารางสอน
              </Typography>
            )}
            {schedules?.slice(0, 3).map((slot) => (
              <Box key={slot.id} sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    display: 'grid',
                    borderRadius: 1.5,
                    placeItems: 'center',
                    color: 'primary.main',
                    bgcolor: 'primary.lighter',
                  }}
                >
                  <RemixIcon icon="solar:clock-circle-bold" width={20} />
                </Box>
                <Box>
                  <Typography variant="subtitle2">วัน{DAY_LABELS[slot.day_of_week]}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} น.
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Card>
      </Box>
    </Box>
  );
});

type OverviewCardProps = {
  label: string;
  value: number | null;
  suffix: string;
  icon: 'solar:users-group-rounded-bold' | 'solar:list-bold' | 'solar:calendar-date-bold';
  color: string;
  bgcolor: string;
};

function OverviewCard({ label, value, suffix, icon, color, bgcolor }: OverviewCardProps) {
  return (
    <Card variant="outlined" sx={{ p: { xs: 0.75, sm: 2.5 }, borderRadius: { xs: 1.5, sm: 1 } }}>
      <Box
        sx={{
          gap: { xs: 0.5, sm: 1.5 },
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Box
          sx={{
            width: { xs: 30, sm: 46 },
            height: { xs: 30, sm: 46 },
            flexShrink: 0,
            display: 'grid',
            borderRadius: 1.75,
            placeItems: 'center',
            color,
            bgcolor,
          }}
        >
          <RemixIcon icon={icon} width={20} />
        </Box>
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: '0.95rem', sm: '2rem' } }}>
            {value === null ? (
              <Skeleton width={44} />
            ) : (
              `${value.toLocaleString('th-TH')} ${suffix}`
            )}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              overflow: 'hidden',
              color: 'text.secondary',
              fontSize: { xs: '0.62rem', sm: '0.75rem' },
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </Typography>
        </Box>
      </Box>
    </Card>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="subtitle2" sx={{ mt: 0.25 }}>
        {value}
      </Typography>
    </Box>
  );
}
