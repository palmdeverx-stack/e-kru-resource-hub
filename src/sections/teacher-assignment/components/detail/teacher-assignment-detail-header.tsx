'use client';

import { varAlpha } from 'minimal-shared/utils';
import { useQuery } from '@tanstack/react-query';
import { memo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { getTeachingScheduleStatus } from 'src/utils/teaching-schedule';

import { RemixIcon } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { ScoreReportExportButton } from './score-report-export-button';
import { getRoster, getSchedules } from '../../teacher-assignment-actions';
import { TeacherSubjectImageDialog } from '../teacher-subject-image-dialog';

type Props = {
  teacherAssignmentId: string;
};

export const TeacherAssignmentDetailHeader = memo(function TeacherAssignmentDetailHeader({
  teacherAssignmentId,
}: Props) {
  const { user } = useAuthContext();
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const isTeacher = user?.role === 'teacher';
  const backPath = isTeacher ? paths.teacher.assignments : paths.admin.teacherAssignment.root;
  const assignmentNewPath = isTeacher
    ? paths.teacher.assignmentNew(teacherAssignmentId)
    : paths.admin.teacherAssignment.assignmentNew(teacherAssignmentId);

  const { data: roster, isLoading } = useQuery({
    queryKey: ['roster', teacherAssignmentId],
    queryFn: () => getRoster(teacherAssignmentId),
  });
  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules', teacherAssignmentId],
    queryFn: () => getSchedules(teacherAssignmentId),
  });

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const scheduleStatus =
    currentTime && schedules ? getTeachingScheduleStatus(schedules, currentTime) : null;
  const activeSchedule =
    roster?.semesterIsActive && scheduleStatus?.active ? scheduleStatus.active : null;
  const statusLabel = !roster?.semesterIsActive
    ? 'ภาคเรียนสิ้นสุด'
    : activeSchedule
      ? `กำลังสอน · ${activeSchedule.start_time.slice(0, 5)}–${activeSchedule.end_time.slice(0, 5)} น.`
      : scheduleStatus?.next
        ? `คาบถัดไปวันนี้ · ${scheduleStatus.next.start_time.slice(0, 5)} น.`
        : scheduleStatus?.hasScheduleToday
          ? 'ขณะนี้ไม่มีคาบสอน'
          : 'วันนี้ไม่มีคาบสอน';

  return (
    <>
      <Button
        component={RouterLink}
        href={backPath}
        color="inherit"
        startIcon={<RemixIcon icon="solar:reply-bold" />}
        aria-label="กลับหน้าครูประจำวิชา"
        sx={{
          mb: { xs: 1, sm: 2 },
          minWidth: { xs: 40, sm: 64 },
          px: { xs: 1, sm: 2 },
          '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } },
        }}
      >
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
          กลับหน้าครูประจำวิชา
        </Box>
      </Button>

      <Card
        sx={{
          mb: { xs: 2, sm: 3 },
          p: { xs: 1.25, sm: 2 },
          borderRadius: { xs: 2.5, sm: 2 },
          color: 'common.white',
          overflow: 'hidden',
          position: 'relative',
          background: (theme) =>
            `linear-gradient(135deg, ${theme.vars.palette.primary.darker} 0%, ${theme.vars.palette.primary.main} 100%)`,
          '&::after': {
            width: 240,
            height: 240,
            content: '""',
            borderRadius: '50%',
            position: 'absolute',
            right: -90,
            bottom: -170,
            bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.08),
          },
        }}
      >
        <Box
          sx={{
            zIndex: 1,
            gap: { xs: 1.25, sm: 2.5 },
            display: { xs: 'grid', sm: 'flex' },
            position: 'relative',
            alignItems: { xs: 'flex-start' },
            flexDirection: { xs: 'column', sm: 'row' },
            gridTemplateAreas: { xs: '"image info" "actions actions"', sm: 'none' },
            gridTemplateColumns: { xs: '64px minmax(0, 1fr)', sm: 'none' },
          }}
        >
          <Avatar
            src={roster?.subjectImageUrl ?? undefined}
            variant="rounded"
            sx={{
              width: { xs: 64, sm: 140 },
              height: { xs: 64, sm: 140 },
              gridArea: { xs: 'image', sm: 'auto' },
              color: 'primary.darker',
              bgcolor: 'common.white',
            }}
          >
            <RemixIcon icon="solar:notes-bold-duotone" width={30} />
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1, gridArea: { xs: 'info', sm: 'auto' } }}>
            <Typography
              variant="overline"
              sx={{ opacity: 0.72, fontSize: { xs: '0.6rem', sm: '0.75rem' } }}
            >
              รายละเอียดการสอน
            </Typography>
            <Typography
              component="h1"
              variant="h3"
              sx={{ fontSize: { xs: '1.15rem', sm: '2rem', md: '2.5rem' } }}
            >
              {isLoading ? (
                <Skeleton width={240} />
              ) : (
                `${roster?.subjectCode ? `${roster.subjectCode} · ` : ''}${roster?.subjectName ?? 'รายวิชา'}`
              )}
            </Typography>
            <Box
              sx={{
                gap: { xs: 0.5, sm: 1.5 },
                mt: { xs: 0.25, sm: 1 },
                display: 'flex',
                flexWrap: 'wrap',
                color: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.78),
              }}
            >
              <Typography variant="body2">ห้อง {roster?.classroomName ?? '-'}</Typography>
              <Typography variant="body2">•</Typography>
              <Typography variant="body2" noWrap>
                ปีการศึกษา {roster?.semesterName}/{roster?.academicYear ?? '-'}
              </Typography>
            </Box>
            {isLoading || schedulesLoading || !currentTime ? (
              <Skeleton width={150} height={28} sx={{ mt: 1.5 }} />
            ) : (
              <Chip
                size="small"
                icon={
                  <RemixIcon
                    icon={activeSchedule ? 'solar:play-circle-bold' : 'solar:clock-circle-bold'}
                  />
                }
                label={statusLabel}
                sx={(theme) => ({
                  mt: { xs: 0.75, sm: 1.5 },
                  maxWidth: 1,
                  color: 'common.white',
                  fontWeight: 700,
                  bgcolor: activeSchedule
                    ? 'success.main'
                    : varAlpha(theme.vars.palette.common.whiteChannel, 0.16),
                  '& .MuiChip-icon': { color: 'inherit' },
                })}
              />
            )}
          </Box>
          <Box
            sx={{
              gap: 0.75,
              width: { xs: 1, sm: 'auto' },
              display: { xs: 'grid', sm: 'flex' },
              flexWrap: 'wrap',
              gridArea: { xs: 'actions', sm: 'auto' },
              gridTemplateColumns: { xs: '40px 40px minmax(0, 1fr)', sm: 'none' },
            }}
          >
            <ScoreReportExportButton teacherAssignmentId={teacherAssignmentId} compactOnMobile />
            <Button
              variant="outlined"
              disabled={!roster?.subjectId}
              onClick={() => setImageDialogOpen(true)}
              startIcon={<RemixIcon icon="solar:pen-bold" />}
              aria-label="จัดการรูปวิชา"
              sx={(theme) => ({
                minWidth: { xs: 40, sm: 64 },
                px: { xs: 1, sm: 2 },
                flexShrink: 0,
                color: 'common.white',
                borderColor: varAlpha(theme.vars.palette.common.whiteChannel, 0.4),
                '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } },
                '&:hover': {
                  borderColor: 'common.white',
                  bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.08),
                },
              })}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                จัดการรูปวิชา
              </Box>
            </Button>
            <Button
              component={RouterLink}
              href={assignmentNewPath}
              variant="contained"
              color="secondary"
              startIcon={<RemixIcon icon="mingcute:add-line" />}
              sx={{ minWidth: 0, flexShrink: 0, color: 'primary.darker' }}
            >
              สร้างงาน
            </Button>
          </Box>
        </Box>
      </Card>

      <TeacherSubjectImageDialog
        open={imageDialogOpen}
        subjectId={roster?.subjectId ?? ''}
        subjectName={roster?.subjectName ?? 'รายวิชา'}
        imageUrl={roster?.subjectImageUrl ?? null}
        onClose={() => setImageDialogOpen(false)}
      />
    </>
  );
});
