'use client';

import type { TeacherDashboardSummary } from '../teacher-dashboard-actions';

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

import { RouterLink } from 'src/routes/components';

import { RemixIcon } from 'src/components/remix-icon';

import { getTeacherDashboardSummaryFor } from '../teacher-dashboard-actions';

// ----------------------------------------------------------------------

const SUMMARY_CARDS = [
  { key: 'subjects', label: 'รายวิชาที่สอน', suffix: 'วิชา', icon: 'solar:notebook-bold-duotone' },
  {
    key: 'classrooms',
    label: 'ห้องเรียน',
    suffix: 'ห้อง',
    icon: 'solar:users-group-rounded-bold-duotone',
  },
  { key: 'students', label: 'นักเรียนทั้งหมด', suffix: 'คน', icon: 'solar:user-rounded-bold' },
  { key: 'assignments', label: 'งานที่มอบหมาย', suffix: 'งาน', icon: 'solar:list-bold' },
  {
    key: 'waiting_to_grade',
    label: 'งานรอตรวจ',
    suffix: 'รายการ',
    icon: 'solar:file-check-bold-duotone',
  },
] as const;

function displayName(person: TeacherDashboardSummary['teacher']) {
  return `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || person.username;
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

type Props = { teacherId: string; backHref: string };

export function TeacherTeachingOverviewView({ teacherId, backHref }: Props) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['teacher-teaching-overview', teacherId],
    queryFn: () => getTeacherDashboardSummaryFor(teacherId),
  });

  return (
    <Container maxWidth="lg" sx={{ pb: 5 }}>
      <Box sx={{ mb: 1 }}>
        <Button
          component={RouterLink}
          href={backHref}
          size="small"
          startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
        >
          กลับ
        </Button>
      </Box>

      {isLoading && <OverviewSkeleton />}

      {isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              ลองอีกครั้ง
            </Button>
          }
        >
          ไม่สามารถโหลดข้อมูลการสอนของครูคนนี้ได้ — คุณอาจไม่มีสิทธิ์ดูข้อมูลนี้
        </Alert>
      )}

      {data && (
        <>
          <Box sx={{ mb: 3 }}>
            <Typography component="h1" variant="h4">
              ข้อมูลการสอนของครู{displayName(data.teacher)}
            </Typography>
            <Box sx={{ gap: 1, mt: 1, display: 'flex', flexWrap: 'wrap' }}>
              {data.school && <Chip size="small" variant="soft" label={data.school.name} />}
              <Chip size="small" variant="soft" label={`วันนี้มี ${data.today_schedules.length} คาบ`} />
            </Box>
          </Box>

          <Box
            sx={{
              gap: 2,
              mb: 3,
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(5, 1fr)' },
            }}
          >
            {SUMMARY_CARDS.map((item) => (
              <Card key={item.key} variant="outlined" sx={{ p: 2, borderRadius: 2.5 }}>
                <Box sx={{ gap: 1.25, display: 'flex', alignItems: 'center' }}>
                  <Avatar
                    variant="rounded"
                    sx={{ width: 40, height: 40, color: 'primary.main', bgcolor: 'primary.lighter' }}
                  >
                    <RemixIcon icon={item.icon} width={22} />
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h5">{data.summary[item.key].toLocaleString('th-TH')}</Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                      {item.label}
                    </Typography>
                  </Box>
                </Box>
              </Card>
            ))}
          </Box>

          <Card variant="outlined" sx={{ p: 3, borderRadius: 2.5 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              ตารางสอนวันนี้
            </Typography>

            {!data.today_schedules.length ? (
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
                วันนี้ไม่มีคาบสอน
              </Typography>
            ) : (
              <Box sx={{ gap: 1.5, display: 'flex', flexDirection: 'column' }}>
                {data.today_schedules.map((slot) => (
                  <Box
                    key={slot.id}
                    sx={{
                      p: 2,
                      gap: 2,
                      display: 'grid',
                      borderRadius: 2,
                      bgcolor: 'background.neutral',
                      gridTemplateColumns: '92px minmax(0, 1fr)',
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle2">{formatTime(slot.start_time)}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        ถึง {formatTime(slot.end_time)}
                      </Typography>
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>
                        {slot.subject?.code ? `${slot.subject.code} · ` : ''}
                        {slot.subject?.name ?? 'ไม่ระบุรายวิชา'}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                        ห้อง {slot.classroom?.name ?? '-'} · {slot.semester?.name ?? '-'}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Card>
        </>
      )}
    </Container>
  );
}

// ----------------------------------------------------------------------

function OverviewSkeleton() {
  return (
    <>
      <Skeleton width={220} height={40} sx={{ mb: 2 }} />
      <Box
        sx={{
          gap: 2,
          mb: 3,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(5, 1fr)' },
        }}
      >
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} variant="rounded" height={84} sx={{ borderRadius: 2.5 }} />
        ))}
      </Box>
      <Skeleton variant="rounded" height={240} sx={{ borderRadius: 2.5 }} />
    </>
  );
}
