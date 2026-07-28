'use client';

import type { TeacherDashboardSummary } from '../teacher-dashboard-actions';

import { varAlpha } from 'minimal-shared/utils';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { RemixIcon ,
  RiMore2Line,
  RiBriefcaseLine,
  RiFileCheckLine,
  RiPresentationLine,
  RiCalendarScheduleLine,
} from 'src/components/remix-icon';

import { RecentAssignments } from '../components/recent-assignments';
import {
  getTeacherDashboardSummary,
  getTeacherDashboardRecentAssignments,
} from '../teacher-dashboard-actions';

// ----------------------------------------------------------------------

const summaryCards = [
  {
    key: 'subjects',
    label: 'รายวิชาที่สอน',
    suffix: 'วิชา',
    icon: 'solar:notebook-bold-duotone',
    color: 'primary.main',
    bgcolor: 'primary.lighter',
  },
  {
    key: 'classrooms',
    label: 'ห้องเรียน',
    suffix: 'ห้อง',
    icon: 'solar:users-group-rounded-bold-duotone',
    color: 'secondary.dark',
    bgcolor: 'secondary.lighter',
  },
  {
    key: 'students',
    label: 'นักเรียนทั้งหมด',
    suffix: 'คน',
    icon: 'solar:user-rounded-bold',
    color: 'success.main',
    bgcolor: 'success.lighter',
  },
  {
    key: 'assignments',
    label: 'งานที่มอบหมาย',
    suffix: 'งาน',
    icon: 'solar:list-bold',
    color: 'warning.dark',
    bgcolor: 'warning.lighter',
  },
] as const;

function displayName(person: TeacherDashboardSummary['teacher']) {
  return `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || person.username;
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function TeacherDashboardView() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['teacher-dashboard', 'summary'],
    queryFn: getTeacherDashboardSummary,
  });
  const recentQuery = useQuery({
    queryKey: ['teacher-dashboard', 'recent-assignments'],
    queryFn: getTeacherDashboardRecentAssignments,
  });

  if (isLoading) return <TeacherDashboardSkeleton />;

  if (isError || !data) {
    return (
      <Container maxWidth="xl" sx={{ py: 5 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              ลองอีกครั้ง
            </Button>
          }
        >
          ไม่สามารถโหลดข้อมูลแดชบอร์ดได้ กรุณาลองใหม่อีกครั้ง
        </Alert>
      </Container>
    );
  }

  const teacherName = displayName(data.teacher);
  const todayText = new Intl.DateTimeFormat('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(new Date());

  return (
    <Container maxWidth="xl" sx={{ px: { xs: 1.5, sm: 3 }, pb: { xs: 3, sm: 5 } }}>
      <Card
        sx={{
          mb: { xs: 2, sm: 3 },
          p: { xs: 2, sm: 3 },
          borderRadius: { xs: 2.5, sm: 3 },
          color: 'common.white',
          overflow: 'hidden',
          position: 'relative',
          background: (theme) =>
            `linear-gradient(135deg, ${theme.vars.palette.primary.darker} 0%, ${theme.vars.palette.primary.main} 62%, ${theme.vars.palette.primary.light} 100%)`,
          '&::before': {
            top: -110,
            right: -30,
            width: 280,
            height: 280,
            content: '""',
            borderRadius: '50%',
            position: 'absolute',
            bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.08),
          },
        }}
      >
        <Box
          sx={{
            gap: { xs: 2, sm: 3 },
            zIndex: 1,
            display: 'flex',
            flexWrap: 'wrap',
            position: 'relative',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              sx={(theme) => ({
                letterSpacing: 1.1,
                color: varAlpha(theme.vars.palette.common.whiteChannel, 0.78),
              })}
            >
              แดชบอร์ดครู
            </Typography>
            <Typography
              component="h1"
              variant="h3"
              sx={{ mt: 0.25, fontSize: { xs: '1.65rem', sm: '2rem', md: '2.5rem' } }}
            >
              สวัสดี ครู{teacherName}
            </Typography>
            <Typography
              variant="body2"
              sx={(theme) => ({
                mt: 0.75,
                color: varAlpha(theme.vars.palette.common.whiteChannel, 0.8),
              })}
            >
              {todayText}
            </Typography>
            <Box sx={{ gap: 0.75, mt: 1.5, display: 'flex', flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={data.school?.name ?? 'ยังไม่มีข้อมูลโรงเรียน'}
                sx={(theme) => ({
                  color: 'common.white',
                  bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.15),
                })}
              />
              <Chip
                size="small"
                label={`วันนี้มี ${data.today_schedules.length} คาบ`}
                sx={(theme) => ({
                  color: 'common.white',
                  bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.15),
                })}
              />
            </Box>
          </Box>

          <Box
            sx={{
              gap: 1,
              width: { xs: 1, sm: 'auto' },
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(2, auto)' },
            }}
          >
            <Button
              component={RouterLink}
              href={paths.teacher.timetable}
              variant="contained"
              color="inherit"
              startIcon={<RemixIcon icon="solar:calendar-date-bold" />}
              sx={{ minHeight: 44, color: 'primary.darker', bgcolor: 'common.white' }}
            >
              ตารางสอน
            </Button>
            <Button
              component={RouterLink}
              href={paths.teacher.assignments}
              variant="outlined"
              color="inherit"
              startIcon={<RemixIcon icon="solar:notebook-bold-duotone" />}
              sx={(theme) => ({
                minHeight: 44,
                borderColor: varAlpha(theme.vars.palette.common.whiteChannel, 0.5),
                '&:hover': {
                  borderColor: 'common.white',
                  bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.08),
                },
              })}
            >
              วิชาที่สอน
            </Button>
          </Box>
        </Box>
      </Card>

      {data.summary.waiting_to_grade > 0 && (
        <Alert
          severity="warning"
          icon={<RemixIcon icon="solar:file-check-bold-duotone" />}
          action={
            <Button component={RouterLink} href={paths.teacher.assignments} color="inherit">
              ไปตรวจงาน
            </Button>
          }
          sx={{
            mb: { xs: 2, sm: 3 },
            alignItems: 'flex-start',
            '& .MuiAlert-action': {
              mt: { xs: 1, sm: -0.5 },
              ml: { xs: 0, sm: 2 },
              width: { xs: 1, sm: 'auto' },
              justifyContent: { xs: 'flex-end', sm: 'initial' },
            },
            flexWrap: { xs: 'wrap', sm: 'nowrap' },
          }}
        >
          มีงานของนักเรียนรอตรวจและบันทึกคะแนน {data.summary.waiting_to_grade} รายการ
        </Alert>
      )}

      <Box
        sx={{
          gap: { xs: 1.25, sm: 2 },
          mb: { xs: 2, sm: 3 },
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'repeat(4, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
        }}
      >
        {summaryCards.map((item) => (
          <Card
            key={item.key}
            variant="outlined"
            sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: { xs: 2, sm: 2.5 } }}
          >
            <Box sx={{ gap: { xs: 1, sm: 1.75 }, display: 'flex', alignItems: 'center' }}>
              <Avatar
                variant="rounded"
                sx={{
                  width: { xs: 40, sm: 50 },
                  height: { xs: 40, sm: 50 },
                  color: item.color,
                  bgcolor: item.bgcolor,
                }}
              >
                <RemixIcon icon={item.icon} width={24} />
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h4" sx={{ fontSize: { xs: '1.35rem', sm: '2rem' } }}>
                  {data.summary[item.key].toLocaleString('th-TH')}{' '}
                  <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
                    {item.suffix}
                  </Typography>
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    overflow: 'hidden',
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
            </Box>
          </Card>
        ))}
      </Box>

      <Box
        sx={{
          gap: { xs: 2, sm: 3 },
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.55fr) minmax(300px, 0.8fr)' },
        }}
      >
        <Box sx={{ gap: { xs: 2, sm: 3 }, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <TodaySchedule schedules={data.today_schedules} />
          <RecentAssignments
            assignments={recentQuery.data?.recent_assignments}
            isLoading={recentQuery.isLoading}
          />
        </Box>

        <Box sx={{ gap: 3, display: { xs: 'none', sm: 'flex' }, flexDirection: 'column' }}>
          <WorkloadSummary data={data} />
        </Box>
      </Box>
    </Container>
  );
}

// ----------------------------------------------------------------------

function SectionHeader({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href?: string;
}) {
  return (
    <Box sx={{ mb: { xs: 1.25, sm: 2.5 }, display: 'flex', alignItems: 'center' }}>
      <Avatar
        variant="rounded"
        sx={{
          mr: { xs: 0.75, sm: 1.5 },
          width: { xs: 34, sm: 40 },
          height: { xs: 34, sm: 40 },
          color: 'primary.main',
          bgcolor: 'primary.lighter',
        }}
      >
        <RiCalendarScheduleLine size={22} />
      </Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          component="h2"
          variant="h6"
          sx={{ fontSize: { xs: '0.95rem', sm: '1.125rem' } }}
        >
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            overflow: 'hidden',
            color: 'text.secondary',
            fontSize: { xs: '0.7rem', sm: '0.875rem' },
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {description}
        </Typography>
      </Box>
      {href && (
        <Button
          component={RouterLink}
          href={href}
          size="small"
          sx={{
            minWidth: 'auto',
            px: { xs: 0.75, sm: 1 },
            fontSize: { xs: '0.72rem', sm: '0.8125rem' },
          }}
        >
          ดูทั้งหมด
        </Button>
      )}
    </Box>
  );
}

function TodaySchedule({ schedules }: { schedules: TeacherDashboardSummary['today_schedules'] }) {
  const bangkokTime = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
  }).format(new Date());
  const nowMinutes = timeToMinutes(bangkokTime);

  return (
    <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 3 }, borderRadius: { xs: 2, sm: 2.5 } }}>
      <SectionHeader
        title="ตารางสอนวันนี้"
        description={schedules.length ? `${schedules.length} คาบเรียนวันนี้` : 'วันนี้ไม่มีคาบสอน'}
        href={paths.teacher.timetable}
      />

      {schedules.length ? (
        <Box sx={{ gap: { xs: 1, sm: 1.5 }, display: 'flex', flexDirection: 'column' }}>
          {schedules.map((slot) => {
            const start = timeToMinutes(slot.start_time);
            const end = timeToMinutes(slot.end_time);
            const isTeaching = nowMinutes >= start && nowMinutes < end;
            const isFinished = nowMinutes >= end;

            return (
              <Box
                key={slot.id}
                component={RouterLink}
                href={paths.teacher.assignmentDetail(slot.teacher_assignment_id)}
                sx={{
                  gap: { xs: 1.25, sm: 2 },
                  p: { xs: 1.5, sm: 2 },
                  display: 'grid',
                  borderRadius: 2,
                  color: 'text.primary',
                  textDecoration: 'none',
                  bgcolor: isTeaching ? 'primary.lighter' : 'background.neutral',
                  border: '1px solid',
                  borderColor: isTeaching ? 'primary.light' : 'transparent',
                  gridTemplateColumns: {
                    xs: '62px minmax(0, 1fr)',
                    sm: '92px minmax(0, 1fr) auto',
                  },
                  gridTemplateAreas: {
                    xs: '"time detail" "time status"',
                    sm: '"time detail status"',
                  },
                  '&:hover': { borderColor: 'primary.main' },
                }}
              >
                <Box sx={{ gridArea: 'time' }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: isTeaching ? 'primary.main' : 'text.primary' }}
                  >
                    {formatTime(slot.start_time)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    ถึง {formatTime(slot.end_time)}
                  </Typography>
                </Box>
                <Box sx={{ minWidth: 0, gridArea: 'detail' }}>
                  <Typography variant="subtitle2" noWrap>
                    {slot.subject?.code ? `${slot.subject.code} · ` : ''}
                    {slot.subject?.name ?? 'ไม่ระบุรายวิชา'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                    ห้อง {slot.classroom?.name ?? '-'} · {slot.semester?.name ?? '-'}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  variant="soft"
                  color={isTeaching ? 'success' : isFinished ? 'default' : 'info'}
                  label={isTeaching ? 'กำลังสอน' : isFinished ? 'สอนแล้ว' : 'คาบถัดไป'}
                  sx={{
                    gridArea: 'status',
                    justifySelf: { xs: 'start', sm: 'end' },
                    alignSelf: 'center',
                  }}
                />
              </Box>
            );
          })}
        </Box>
      ) : (
        <EmptyState text="วันนี้ไม่มีคาบสอน พักผ่อนให้เต็มที่นะครับ" />
      )}
    </Card>
  );
}

function WorkloadSummary({ data }: { data: TeacherDashboardSummary }) {
  return (
    <Card variant="outlined" sx={{ p: 2.25, borderRadius: 2.5 }}>
      <Box sx={{ gap: 1, mb: 2, display: 'flex', alignItems: 'center' }}>
        <Avatar
          variant="rounded"
          sx={{ width: 38, height: 38, color: 'primary.main', bgcolor: 'primary.lighter' }}
        >
          <RiBriefcaseLine size={20} />
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" variant="h6">
            ภาระงานโดยรวม
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
            ภาพรวมรายการที่คุณรับผิดชอบ
          </Typography>
        </Box>
      </Box>
      <Box sx={{ gap: 1, display: 'flex', flexDirection: 'column' }}>
        <WorkloadRow
          label="รายการสอน"
          description="รายวิชาและห้องที่รับผิดชอบ"
          value={data.summary.teaching_assignments}
          suffix="รายการ"
          icon={RiPresentationLine}
          href={paths.teacher.assignments}
          color="primary"
        />
        <WorkloadRow
          label="คาบสอนวันนี้"
          description="ตารางเรียนประจำวันนี้"
          value={data.today_schedules.length}
          suffix="คาบ"
          icon={RiCalendarScheduleLine}
          href={paths.teacher.timetable}
          color="info"
        />
        <WorkloadRow
          label="งานรอตรวจ"
          description="งานที่รอบันทึกคะแนน"
          value={data.summary.waiting_to_grade}
          suffix="รายการ"
          icon={RiFileCheckLine}
          href={paths.teacher.assignments}
          color={data.summary.waiting_to_grade > 0 ? 'warning' : 'success'}
        />
      </Box>
    </Card>
  );
}

function WorkloadRow({
  label,
  description,
  value,
  suffix,
  icon: WorkloadIcon,
  href,
  color,
}: {
  label: string;
  description: string;
  value: number;
  suffix: string;
  icon: React.ElementType;
  href: string;
  color: 'primary' | 'info' | 'warning' | 'success';
}) {
  return (
    <Box
      component={RouterLink}
      href={href}
      sx={{
        gap: 1,
        p: 1.25,
        display: 'grid',
        borderRadius: 2,
        alignItems: 'center',
        color: 'text.primary',
        textDecoration: 'none',
        bgcolor: 'background.neutral',
        gridTemplateColumns: '40px minmax(0, 1fr) auto 24px',
        transition: (theme) =>
          theme.transitions.create(['transform', 'background-color'], {
            duration: theme.transitions.duration.shorter,
          }),
        '&:hover': {
          transform: 'translateY(-1px)',
          bgcolor: `${color}.lighter`,
        },
      }}
    >
      <Avatar
        variant="rounded"
        sx={{ width: 40, height: 40, color: `${color}.main`, bgcolor: `${color}.lighter` }}
      >
        <WorkloadIcon size={21} />
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }} noWrap>
          {description}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right' }}>
        <Typography variant="subtitle1" sx={{ color: `${color}.dark` }}>
          {value.toLocaleString('th-TH')}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {suffix}
        </Typography>
      </Box>
      <Box sx={{ color: 'text.disabled' }}>
        <RiMore2Line size={20} />
      </Box>
    </Box>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Box sx={{ py: { xs: 3.5, sm: 5 }, textAlign: 'center' }}>
      <Box sx={{ mb: 1, color: 'text.disabled' }}>
        <RiCalendarScheduleLine size={42} />
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {text}
      </Typography>
    </Box>
  );
}

function TeacherDashboardSkeleton() {
  return (
    <Container
      maxWidth="xl"
      aria-label="กำลังโหลดแดชบอร์ดครู"
      sx={{ px: { xs: 1.5, sm: 3 }, pb: 5 }}
    >
      <Skeleton variant="rounded" height={220} sx={{ mb: { xs: 2, sm: 3 }, borderRadius: 3 }} />
      <Box
        sx={{
          gap: { xs: 1.25, sm: 2 },
          mb: { xs: 2, sm: 3 },
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
        }}
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton
            key={index}
            variant="rounded"
            height={104}
            sx={{ height: { xs: 80, sm: 104 }, borderRadius: 2 }}
          />
        ))}
      </Box>
      <Box sx={{ gap: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.55fr 0.8fr' } }}>
        <Skeleton variant="rounded" height={480} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rounded" height={480} sx={{ borderRadius: 2 }} />
      </Box>
    </Container>
  );
}
