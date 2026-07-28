'use client';

import { useMemo } from 'react';
import { varAlpha } from 'minimal-shared/utils';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { today, fIsBetween } from 'src/utils/format-time';

import { RemixIcon } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { EnrolledStudentsExportButtons } from '../components/enrolled-students-export-buttons';
import {
  getAdminDashboardSummary,
  getAdminDashboardRecentActivity,
} from '../admin-dashboard-actions';

// ----------------------------------------------------------------------

const statConfigs = [
  {
    key: 'students',
    label: 'นักเรียนทั้งหมด',
    helper: 'บัญชีนักเรียนในโรงเรียน',
    icon: 'solar:user-rounded-bold',
    color: 'primary.main',
    bgcolor: 'primary.lighter',
    path: paths.admin.student.root,
  },
  {
    key: 'teachers',
    label: 'ครูผู้สอน',
    helper: 'บุคลากรที่พร้อมสอน',
    icon: 'solar:users-group-rounded-bold',
    color: 'success.dark',
    bgcolor: 'success.lighter',
    path: paths.admin.user.root,
  },
  {
    key: 'classrooms',
    label: 'ห้องเรียน',
    helper: 'ห้องเรียนที่สร้างแล้ว',
    icon: 'solar:add-folder-bold',
    color: 'warning.dark',
    bgcolor: 'warning.lighter',
    path: paths.admin.classroom.root,
  },
  {
    key: 'subjects',
    label: 'รายวิชา',
    helper: 'รายวิชาในระบบ',
    icon: 'solar:gallery-wide-bold',
    color: 'secondary.dark',
    bgcolor: 'secondary.lighter',
    path: paths.admin.subject.root,
  },
  {
    key: 'enrollments',
    label: 'การลงทะเบียน',
    helper: 'รายการลงทะเบียนทั้งหมด',
    icon: 'solar:file-check-bold-duotone',
    color: 'info.dark',
    bgcolor: 'info.lighter',
    path: paths.admin.enrollment.root,
  },
] as const;

const quickActions = [
  {
    label: 'จัดการนักเรียน',
    description: 'เพิ่มและแก้ไขข้อมูลนักเรียน',
    icon: 'solar:user-plus-bold',
    path: paths.admin.student.root,
    color: 'primary.main',
    bgcolor: 'primary.lighter',
  },
  {
    label: 'จัดการห้องเรียน',
    description: 'เพิ่มห้องและจัดชั้นเรียน',
    icon: 'solar:add-folder-bold',
    path: paths.admin.classroom.root,
    color: 'warning.dark',
    bgcolor: 'warning.lighter',
  },
  {
    label: 'มอบหมายครู',
    description: 'กำหนดครูประจำรายวิชา',
    icon: 'solar:users-group-rounded-bold',
    path: paths.admin.teacherAssignment.root,
    color: 'success.dark',
    bgcolor: 'success.lighter',
  },
  {
    label: 'ลงทะเบียนเรียน',
    description: 'จัดนักเรียนเข้าห้องเรียน',
    icon: 'solar:user-plus-bold',
    path: paths.admin.enrollment.root,
    color: 'info.dark',
    bgcolor: 'info.lighter',
  },
] as const;

function displayName(person: {
  first_name: string | null;
  last_name: string | null;
  username: string;
}) {
  return `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || person.username;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(
    new Date(value)
  );
}

function formatLongDate(value: string | null) {
  if (!value) return 'ไม่ระบุ';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function AdminDashboardView() {
  const { user } = useAuthContext();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-dashboard', 'summary'],
    queryFn: getAdminDashboardSummary,
  });
  const activityQuery = useQuery({
    queryKey: ['admin-dashboard', 'recent-activity'],
    queryFn: getAdminDashboardRecentActivity,
  });

  const activities = useMemo(() => {
    const activityData = activityQuery.data;
    if (!activityData) return [];
    return [
      ...activityData.recentAssignments.map((item) => ({
        id: `assignment-${item.id}`,
        date: item.created_at,
        type: 'มอบหมายครู',
        icon: 'solar:users-group-rounded-bold' as const,
        color: 'success.dark',
        bgcolor: 'success.lighter',
        title: displayName(item.teacher),
        detail: `${item.subject.code ? `${item.subject.code} · ` : ''}${item.subject.name} · ${item.classroom.name}`,
      })),
      ...activityData.recentEnrollments.map((item) => ({
        id: `enrollment-${item.id}`,
        date: item.created_at,
        type: 'ลงทะเบียนเรียน',
        icon: 'solar:user-plus-bold' as const,
        color: 'primary.main',
        bgcolor: 'primary.lighter',
        title: displayName(item.student),
        detail: `${item.classroom.name}${item.student_number ? ` · เลขที่ ${item.student_number}` : ''}`,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [activityQuery.data]);

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !data) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={() => refetch()}>
              ลองอีกครั้ง
            </Button>
          }
        >
          ไม่สามารถโหลดข้อมูลภาพรวมได้
        </Alert>
      </Container>
    );
  }

  const activeSemester = data.academicYear?.semesters.find(
    (semester) => semester.is_active || fIsBetween(today(), semester.start_date, semester.end_date)
  );
  const checklist = [
    {
      label: 'กำหนดปีการศึกษา',
      complete: !!data.academicYear,
      path: paths.admin.academicYear.root,
    },
    {
      label: 'เพิ่มภาคเรียน',
      complete: !!data.academicYear?.semesters.length,
      path: paths.admin.academicYear.root,
    },
    { label: 'เพิ่มครูผู้สอน', complete: data.counts.teachers > 0, path: paths.admin.user.root },
    {
      label: 'สร้างห้องเรียน',
      complete: data.counts.classrooms > 0,
      path: paths.admin.classroom.root,
    },
    { label: 'เปิดรายวิชา', complete: data.counts.subjects > 0, path: paths.admin.subject.root },
    {
      label: 'ลงทะเบียนนักเรียน',
      complete: data.counts.enrollments > 0,
      path: paths.admin.enrollment.root,
    },
  ];
  const completedSteps = checklist.filter((item) => item.complete).length;
  const setupProgress = Math.round((completedSteps / checklist.length) * 100);
  const nextStep = checklist.find((item) => !item.complete);

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Box
        sx={{
          mb: 3,
          gap: 2,
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary' }}>
            สวัสดี {user?.first_name || user?.username || 'ผู้ดูแลโรงเรียน'}
          </Typography>
          <Typography component="h1" variant="h3">
            ภาพรวมโรงเรียน
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.75, color: 'text.secondary' }}>
            ข้อมูลสำคัญและรายการที่ต้องดูแลในวันนี้
          </Typography>
        </Box>
        <Box
          sx={{
            gap: 1,
            display: 'flex',
            alignItems: { xs: 'stretch', sm: 'flex-start' },
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <EnrolledStudentsExportButtons />
          <Button
            component={RouterLink}
            href={paths.admin.school}
            variant="outlined"
            startIcon={<RemixIcon icon="solar:settings-bold" />}
          >
            ตั้งค่าโรงเรียน
          </Button>
        </Box>
      </Box>

      <Card
        sx={{
          mb: 3,
          p: { xs: 2.5, md: 3 },
          color: 'common.white',
          overflow: 'hidden',
          position: 'relative',
          background: (theme) =>
            `linear-gradient(120deg, ${theme.vars.palette.primary.darker} 0%, ${theme.vars.palette.primary.main} 100%)`,
          '&::before': {
            top: -110,
            right: -30,
            width: 260,
            height: 260,
            content: '""',
            borderRadius: '50%',
            position: 'absolute',
            bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.08),
          },
        }}
      >
        <Box
          sx={{
            zIndex: 1,
            gap: 3,
            display: 'grid',
            position: 'relative',
            alignItems: 'center',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
          }}
        >
          <Box sx={{ gap: 2, minWidth: 0, display: 'flex', alignItems: 'center' }}>
            <Avatar
              src={data.school.logo_url ?? undefined}
              alt={data.school.name}
              variant="rounded"
              sx={{
                width: { xs: 58, sm: 68 },
                height: { xs: 58, sm: 68 },
                flexShrink: 0,
                fontSize: 28,
                color: 'primary.main',
                bgcolor: 'common.white',
                boxShadow: (theme) => theme.vars.customShadows.z8,
              }}
            >
              {data.school.name.charAt(0)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" sx={{ opacity: 0.72 }}>
                โรงเรียนของคุณ · รหัส {data.school.code}
              </Typography>
              <Typography variant="h4" noWrap>
                {data.school.name}
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              gap: 2,
              display: 'flex',
              minWidth: { md: 390 },
              alignItems: 'center',
              p: { xs: 2, sm: 2.25 },
              borderRadius: 2,
              bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.12),
              border: (theme) =>
                `1px solid ${varAlpha(theme.vars.palette.common.whiteChannel, 0.16)}`,
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                flexShrink: 0,
                display: 'grid',
                borderRadius: 1.5,
                placeItems: 'center',
                bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.14),
              }}
            >
              <RemixIcon icon="solar:calendar-date-bold" width={25} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="caption" sx={{ opacity: 0.72 }}>
                ปีการศึกษาปัจจุบัน
              </Typography>
              <Typography variant="subtitle1">
                {data.academicYear ? `ปี ${data.academicYear.year}` : 'ยังไม่ได้กำหนด'}
                {activeSemester ? ` · ${activeSemester.name}` : ''}
              </Typography>
              {activeSemester && (
                <Typography variant="caption" sx={{ opacity: 0.72 }}>
                  {formatLongDate(activeSemester.start_date)} –{' '}
                  {formatLongDate(activeSemester.end_date)}
                </Typography>
              )}
            </Box>
            <Chip
              size="small"
              icon={<RemixIcon icon="solar:check-circle-bold" width={16} />}
              label={activeSemester ? 'กำลังใช้งาน' : 'รอตั้งค่า'}
              sx={(theme) => ({
                flexShrink: 0,
                color: 'common.white',
                bgcolor: activeSemester
                  ? varAlpha(theme.vars.palette.success.lightChannel, 0.28)
                  : varAlpha(theme.vars.palette.warning.lightChannel, 0.25),
                '& .MuiChip-icon': { color: 'inherit' },
              })}
            />
          </Box>
        </Box>
      </Card>

      <Box
        sx={{
          mb: 4,
          gap: 2,
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(5, 1fr)',
          },
        }}
      >
        {statConfigs.map((stat) => (
          <Card
            key={stat.key}
            component={RouterLink}
            href={stat.path}
            variant="outlined"
            sx={{
              p: 2.5,
              color: 'text.primary',
              textDecoration: 'none',
              transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
              '&:hover': {
                transform: 'translateY(-3px)',
                borderColor: stat.color,
                boxShadow: (theme) => theme.vars.customShadows.z8,
              },
            }}
          >
            <Box
              sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  display: 'grid',
                  borderRadius: 1.75,
                  placeItems: 'center',
                  color: stat.color,
                  bgcolor: stat.bgcolor,
                }}
              >
                <RemixIcon icon={stat.icon} width={24} />
              </Box>
              <RemixIcon
                icon="eva:diagonal-arrow-right-up-fill"
                width={20}
                sx={{ color: 'text.disabled' }}
              />
            </Box>
            <Typography variant="h3" sx={{ mb: 0.25 }}>
              {data.counts[stat.key].toLocaleString('th-TH')}
            </Typography>
            <Typography variant="subtitle2">{stat.label}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {stat.helper}
            </Typography>
          </Card>
        ))}
      </Box>

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.65fr) minmax(320px, 0.75fr)' },
        }}
      >
        <Box sx={{ gap: 3, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Card variant="outlined">
            <Box
              sx={{
                gap: 2,
                p: { xs: 2.5, sm: 3 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography component="h2" variant="h6">
                  ความเคลื่อนไหวล่าสุด
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  รายการมอบหมายครูและลงทะเบียนนักเรียน
                </Typography>
              </Box>
              <Button
                component={RouterLink}
                href={paths.admin.teacherAssignment.root}
                size="small"
                endIcon={<RemixIcon icon="eva:arrow-forward-fill" />}
              >
                ดูรายการ
              </Button>
            </Box>
            <Divider />
            {activityQuery.isLoading ? (
              <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
                <Box sx={{ gap: 1.5, display: 'flex', flexDirection: 'column' }}>
                  {Array.from({ length: 3 }, (_, index) => (
                    <Skeleton key={index} variant="rounded" height={64} sx={{ borderRadius: 2 }} />
                  ))}
                </Box>
              </Box>
            ) : activities.length ? (
              activities.map((activity, index) => (
                <Box key={activity.id}>
                  <Box
                    sx={{
                      gap: 1.5,
                      px: { xs: 2.5, sm: 3 },
                      py: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        flexShrink: 0,
                        display: 'grid',
                        borderRadius: 1.5,
                        placeItems: 'center',
                        color: activity.color,
                        bgcolor: activity.bgcolor,
                      }}
                    >
                      <RemixIcon icon={activity.icon} width={22} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ gap: 1, display: 'flex', alignItems: 'center' }}>
                        <Typography variant="subtitle2" noWrap>
                          {activity.title}
                        </Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={activity.type}
                          sx={{ height: 22, display: { xs: 'none', sm: 'inline-flex' } }}
                        />
                      </Box>
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{ display: 'block', color: 'text.secondary' }}
                      >
                        {activity.detail}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ flexShrink: 0, color: 'text.disabled' }}>
                      {formatShortDate(activity.date)}
                    </Typography>
                  </Box>
                  {index < activities.length - 1 && <Divider />}
                </Box>
              ))
            ) : (
              <Box sx={{ px: 3, py: 7, textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    mx: 'auto',
                    mb: 1.5,
                    display: 'grid',
                    borderRadius: '50%',
                    placeItems: 'center',
                    color: 'text.disabled',
                    bgcolor: 'action.hover',
                  }}
                >
                  <RemixIcon icon="solar:inbox-in-bold" width={28} />
                </Box>
                <Typography variant="subtitle2">ยังไม่มีกิจกรรมล่าสุด</Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                  รายการใหม่จะแสดงที่นี่เมื่อเริ่มใช้งานระบบ
                </Typography>
              </Box>
            )}
          </Card>

          <Box>
            <Box
              sx={{
                mb: 1.5,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography component="h2" variant="h6">
                  เมนูใช้งานบ่อย
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  เข้าถึงงานประจำได้อย่างรวดเร็ว
                </Typography>
              </Box>
            </Box>
            <Box
              sx={{
                gap: 1.5,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              }}
            >
              {quickActions.map((action) => (
                <Card
                  key={action.label}
                  component={RouterLink}
                  href={action.path}
                  variant="outlined"
                  sx={{
                    p: 2,
                    gap: 1.5,
                    display: 'flex',
                    color: 'text.primary',
                    alignItems: 'center',
                    textDecoration: 'none',
                    transition: 'border-color 160ms ease, background-color 160ms ease',
                    '&:hover': { borderColor: action.color, bgcolor: 'action.hover' },
                  }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      flexShrink: 0,
                      display: 'grid',
                      borderRadius: 1.5,
                      placeItems: 'center',
                      color: action.color,
                      bgcolor: action.bgcolor,
                    }}
                  >
                    <RemixIcon icon={action.icon} width={23} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle2">{action.label}</Typography>
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{ display: 'block', color: 'text.secondary' }}
                    >
                      {action.description}
                    </Typography>
                  </Box>
                  <RemixIcon
                    icon="eva:arrow-ios-forward-fill"
                    width={18}
                    sx={{ color: 'text.disabled' }}
                  />
                </Card>
              ))}
            </Box>
          </Box>
        </Box>

        <Card variant="outlined" sx={{ overflow: 'hidden' }}>
          <Box sx={{ p: 3 }}>
            <Box
              sx={{
                mb: 2,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography component="h2" variant="h6">
                  ความพร้อมของระบบ
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.25, color: 'text.secondary' }}>
                  ตั้งค่าพื้นฐานสำหรับเริ่มใช้งาน
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  display: 'grid',
                  borderRadius: '50%',
                  placeItems: 'center',
                  color: setupProgress === 100 ? 'success.dark' : 'primary.main',
                  bgcolor: setupProgress === 100 ? 'success.lighter' : 'primary.lighter',
                }}
              >
                <Typography variant="subtitle2">{setupProgress}%</Typography>
              </Box>
            </Box>
            <LinearProgress
              variant="determinate"
              value={setupProgress}
              color={setupProgress === 100 ? 'success' : 'primary'}
              sx={{ height: 7, borderRadius: 1 }}
            />
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
              เสร็จแล้ว {completedSteps} จาก {checklist.length} รายการ
            </Typography>
          </Box>
          <Divider />
          <Box sx={{ p: 2 }}>
            {checklist.map((item, index) => (
              <Box
                key={item.label}
                component={RouterLink}
                href={item.path}
                sx={{
                  gap: 1.25,
                  px: 1,
                  py: 1.25,
                  display: 'flex',
                  borderRadius: 1,
                  color: 'text.primary',
                  alignItems: 'center',
                  textDecoration: 'none',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Box
                  sx={{
                    width: 25,
                    height: 25,
                    flexShrink: 0,
                    display: 'grid',
                    borderRadius: '50%',
                    placeItems: 'center',
                    color: item.complete ? 'success.main' : 'text.secondary',
                    bgcolor: item.complete ? 'success.lighter' : 'action.hover',
                  }}
                >
                  {item.complete ? (
                    <RemixIcon icon="solar:check-circle-bold" width={15} />
                  ) : (
                    <Typography variant="caption">{index + 1}</Typography>
                  )}
                </Box>
                <Typography
                  variant="body2"
                  sx={{ flex: 1, color: item.complete ? 'text.secondary' : 'text.primary' }}
                >
                  {item.label}
                </Typography>
                {!item.complete && (
                  <RemixIcon
                    icon="eva:arrow-ios-forward-fill"
                    width={17}
                    sx={{ color: 'text.disabled' }}
                  />
                )}
              </Box>
            ))}
          </Box>
          <Divider />
          <Box sx={{ p: 2.5 }}>
            {nextStep ? (
              <>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  ขั้นตอนถัดไปที่แนะนำ
                </Typography>
                <Typography variant="subtitle2" sx={{ mt: 0.25 }}>
                  {nextStep.label}
                </Typography>
                <Button
                  component={RouterLink}
                  href={nextStep.path}
                  fullWidth
                  variant="contained"
                  endIcon={<RemixIcon icon="eva:arrow-forward-fill" />}
                  sx={{ mt: 1.5 }}
                >
                  ดำเนินการต่อ
                </Button>
              </>
            ) : (
              <Alert severity="success" icon={<RemixIcon icon="solar:verified-check-bold" />}>
                ระบบพร้อมใช้งานครบทุกส่วนแล้ว
              </Alert>
            )}
          </Box>
        </Card>
      </Box>
    </Container>
  );
}

function DashboardSkeleton() {
  return (
    <Container maxWidth="xl" sx={{ pb: { xs: 5, md: 7 } }}>
      <Box sx={{ mb: 3 }}>
        <Skeleton width={120} height={22} />
        <Skeleton width={260} height={48} />
        <Skeleton width={320} height={24} />
      </Box>
      <Skeleton variant="rounded" height={144} sx={{ mb: 3 }} />
      <Box
        sx={{
          mb: 4,
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' },
        }}
      >
        {[0, 1, 2, 3, 4].map((item) => (
          <Skeleton key={item} variant="rounded" height={168} />
        ))}
      </Box>
      <Box
        sx={{ gap: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.65fr 0.75fr' } }}
      >
        <Skeleton variant="rounded" height={440} />
        <Skeleton variant="rounded" height={440} />
      </Box>
    </Container>
  );
}
