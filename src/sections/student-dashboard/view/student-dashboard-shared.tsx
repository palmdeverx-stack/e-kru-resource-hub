'use client';

import type { RemixIconName } from 'src/components/remix-icon/icon-map';
import type {
  StudentPerson,
  SubmissionStatus,
  StudentDashboardBase,
} from '../student-dashboard-actions';

import { varAlpha } from 'minimal-shared/utils';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { fIsBetween, today as getTodayDate } from 'src/utils/format-time';

import { RemixIcon } from 'src/components/remix-icon';

import {
  getStudentHomeDashboard,
  getStudentSubjectsDashboard,
  getStudentClassroomDashboard,
  getStudentAssignmentsDashboard,
} from '../student-dashboard-actions';

// ----------------------------------------------------------------------

export type StudentDashboardSection =
  | 'home'
  | 'classroom'
  | 'subjects'
  | 'timetable'
  | 'assignments';

// ----------------------------------------------------------------------

export function displayName(person: Pick<StudentPerson, 'username' | 'first_name' | 'last_name'>) {
  return `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || person.username;
}

export function isSubmitted(status: SubmissionStatus) {
  return ['submitted', 'late', 'pending_review'].includes(status);
}

export function getCurrentEnrollment(data: StudentDashboardBase) {
  return (
    data.enrollments.find((row) =>
      fIsBetween(
        getTodayDate(),
        row.classroom.academic_year?.start_date,
        row.classroom.academic_year?.end_date
      )
    ) ?? data.enrollments[0]
  );
}

export function useStudentHomeDashboard() {
  return useQuery({
    queryKey: ['student-dashboard', 'home'],
    queryFn: getStudentHomeDashboard,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useStudentClassroomDashboard() {
  return useQuery({
    queryKey: ['student-dashboard', 'classroom'],
    queryFn: getStudentClassroomDashboard,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useStudentSubjectsDashboard() {
  return useQuery({
    queryKey: ['student-dashboard', 'subjects'],
    queryFn: getStudentSubjectsDashboard,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useStudentAssignmentsDashboard() {
  return useQuery({
    queryKey: ['student-dashboard', 'assignments'],
    queryFn: getStudentAssignmentsDashboard,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function StudentPageState({
  isLoading,
  isError,
  onRetry,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) return <StudentDashboardSkeleton />;
  if (!isError) return null;

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={onRetry}>
            ลองอีกครั้ง
          </Button>
        }
      >
        ไม่สามารถโหลดข้อมูลการเรียนได้
      </Alert>
    </Container>
  );
}

export function StudentPageScaffold({
  data,
  section,
  stats,
  children,
}: {
  data: StudentDashboardBase;
  section: StudentDashboardSection;
  stats: React.ReactNode;
  children: React.ReactNode;
}) {
  const currentEnrollment = getCurrentEnrollment(data);
  const sectionLabel = {
    home: 'หน้าหลักนักเรียน',
    classroom: 'ห้องเรียนของฉัน',
    subjects: 'วิชาเรียนของฉัน',
    timetable: 'ตารางเรียนของฉัน',
    assignments: 'งานที่ต้องส่ง',
  }[section];

  return (
    <Container
      component="main"
      maxWidth="lg"
      sx={{ minHeight: 'calc(100vh - 100px)', pb: { xs: 2, sm: 3 }, pt: 3 }}
    >
      <Box
        component="section"
        aria-labelledby={`${section}-page-title`}
        sx={{
          p: { xs: 2.5, sm: 3, md: 4 },
          mb: { xs: 2, md: 3 },
          gap: 3,
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: { xs: 2.5, md: 4 },
          color: 'common.white',
          background: (theme) =>
            `linear-gradient(135deg, ${theme.vars.palette.primary.darker} 0%, ${theme.vars.palette.primary.main} 62%, ${theme.vars.palette.primary.light} 100%)`,
          boxShadow: (theme) => theme.customShadows.primary,
          '&::before': {
            content: '""',
            top: -90,
            right: -45,
            width: 240,
            height: 240,
            position: 'absolute',
            borderRadius: '50%',
            bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.07),
          },
          '&::after': {
            content: '""',
            right: 150,
            bottom: -110,
            width: 180,
            height: 180,
            position: 'absolute',
            borderRadius: '50%',
            border: (theme) =>
              `28px solid ${varAlpha(theme.vars.palette.common.whiteChannel, 0.05)}`,
          },
          '& > *': { zIndex: 1 },
        }}
      >
        <Stack direction="row" spacing={{ xs: 1.5, sm: 2 }} alignItems="center">
          <Avatar
            aria-hidden
            sx={{
              width: { xs: 54, md: 68 },
              height: { xs: 54, md: 68 },
              color: 'primary.darker',
              bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.9),
              fontSize: { xs: 22, md: 28 },
              fontWeight: 800,
            }}
          >
            {(data.student.first_name ?? data.student.username).slice(0, 1).toUpperCase()}
          </Avatar>
          <Box>
            <Typography
              variant="overline"
              sx={(theme) => ({
                color: varAlpha(theme.vars.palette.common.whiteChannel, 0.76),
                letterSpacing: 1.1,
              })}
            >
              {sectionLabel}
            </Typography>
            <Typography
              id={`${section}-page-title`}
              component="h1"
              variant="h3"
              sx={{ fontSize: { xs: '1.65rem', sm: '2rem', md: '2.5rem' }, lineHeight: 1.18 }}
            >
              {displayName(data.student)}
            </Typography>
            {currentEnrollment && (
              <Typography
                sx={(theme) => ({
                  mt: 0.5,
                  color: varAlpha(theme.vars.palette.common.whiteChannel, 0.8),
                })}
              >
                ห้อง {currentEnrollment.classroom.name}
                {currentEnrollment.student_number &&
                  ` · เลขที่ ${currentEnrollment.student_number}`}
                {currentEnrollment.classroom.academic_year?.year &&
                  ` · ปีการศึกษา ${currentEnrollment.classroom.academic_year.year}`}
              </Typography>
            )}
          </Box>
        </Stack>

        {stats}
      </Box>

      {!data.enrollments.length && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
          ยังไม่มีข้อมูลการลงทะเบียนห้องเรียน กรุณาติดต่อผู้ดูแลโรงเรียน
        </Alert>
      )}

      {children}
    </Container>
  );
}

export function HeroStats({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        gap: 1,
        width: { xs: 1, lg: 'auto' },
        display: 'grid',
        gridTemplateColumns: `repeat(${Array.isArray(children) ? children.length : 1}, minmax(0, 1fr))`,
      }}
    >
      {children}
    </Box>
  );
}

export function HeroStat({
  icon,
  label,
  value,
}: {
  icon: RemixIconName;
  label: string;
  value: number | string;
}) {
  return (
    <Box
      role="group"
      aria-label={`${label} ${value}`}
      sx={{
        px: { xs: 1, sm: 1.75 },
        py: { xs: 1, sm: 1.25 },
        minWidth: 0,
        borderRadius: 2,
        backdropFilter: 'blur(6px)',
        bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.13),
        border: (theme) => `1px solid ${varAlpha(theme.vars.palette.common.whiteChannel, 0.22)}`,
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 0.5, sm: 1 }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
      >
        <RemixIcon icon={icon} width={22} aria-hidden />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ lineHeight: 1, fontSize: { xs: '1.1rem', sm: '1.5rem' } }}>
            {value}
          </Typography>
          <Typography
            variant="caption"
            noWrap
            sx={{
              display: 'block',
              color: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.78),
              fontSize: { xs: '0.65rem', sm: '0.75rem' },
            }}
          >
            {label}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

export function SectionHeading({
  icon,
  title,
  subtitle,
  compact = false,
}: {
  icon: RemixIconName;
  title: string;
  subtitle: string;
  compact?: boolean;
}) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ mb: compact ? 2 : 2.5 }}>
      <Box
        sx={{
          width: 40,
          height: 40,
          display: 'grid',
          flexShrink: 0,
          borderRadius: 1.5,
          placeItems: 'center',
          color: 'primary.main',
          bgcolor: 'primary.lighter',
        }}
      >
        <RemixIcon icon={icon} width={22} />
      </Box>
      <Box>
        <Typography component="h2" variant={compact ? 'h6' : 'h5'} sx={{ lineHeight: 1.3 }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {subtitle}
        </Typography>
      </Box>
    </Stack>
  );
}

export function EmptyCard({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <Box
      sx={{
        p: compact ? 2.5 : 5,
        textAlign: 'center',
        borderRadius: 2,
        color: 'text.secondary',
        bgcolor: 'background.neutral',
        border: '1px dashed',
        borderColor: 'divider',
      }}
    >
      <RemixIcon icon="solar:notebook-bold-duotone" width={32} sx={{ mb: 1, opacity: 0.5 }} />
      <Typography variant="body2">{text}</Typography>
    </Box>
  );
}

function StudentDashboardSkeleton() {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Skeleton variant="rounded" height={190} sx={{ borderRadius: 3 }} />
      <Box
        sx={{ mt: 3, gap: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}
      >
        <Skeleton variant="rounded" height={390} sx={{ borderRadius: 3 }} />
        <Skeleton variant="rounded" height={390} sx={{ borderRadius: 3 }} />
      </Box>
    </Container>
  );
}
