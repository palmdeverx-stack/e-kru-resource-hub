'use client';

import type { ProgressStatus } from '../enrollment-actions';

import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import LinearProgress from '@mui/material/LinearProgress';
import TableContainer from '@mui/material/TableContainer';

import { RemixIcon } from 'src/components/remix-icon';

import { ProgressSummary } from './progress-summary';
import { getEnrollmentProgress } from '../enrollment-actions';

// ----------------------------------------------------------------------

const STATUS_CONFIG = {
  submitted: { label: 'ส่งแล้ว', color: 'success' },
  late: { label: 'ส่งช้า', color: 'warning' },
  not_submitted: { label: 'ยังไม่ส่ง', color: 'error' },
  absent: { label: 'ขาดเรียน', color: 'default' },
  sick_leave: { label: 'ลาป่วย', color: 'info' },
  pending_review: { label: 'รอตรวจ', color: 'secondary' },
} as const satisfies Record<
  ProgressStatus,
  { label: string; color: 'success' | 'warning' | 'error' | 'default' | 'info' | 'secondary' }
>;

type Props = {
  enrollmentId: string | null;
  onClose: () => void;
};

export function StudentProgressDialog({ enrollmentId, onClose }: Props) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['enrollment-progress', enrollmentId],
    queryFn: () => getEnrollmentProgress(enrollmentId!),
    enabled: !!enrollmentId,
  });

  const assignments = data?.subjects.flatMap((subject) => subject.assignments) ?? [];
  const submittedCount = assignments.filter((assignment) =>
    ['submitted', 'late', 'pending_review'].includes(assignment.status)
  ).length;
  const earnedScore = assignments.reduce((total, assignment) => total + (assignment.score ?? 0), 0);
  const fullScore = assignments.reduce((total, assignment) => total + assignment.full_score, 0);
  const scorePercent = fullScore ? Math.min((earnedScore / fullScore) * 100, 100) : 0;
  const studentName = data
    ? `${data.enrollment.student.first_name ?? ''} ${data.enrollment.student.last_name ?? ''}`.trim() ||
      data.enrollment.student.username
    : '';

  return (
    <Dialog open={!!enrollmentId} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography component="h2" variant="h6">
              ข้อมูลการเรียนของนักเรียน
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              รายวิชา การส่งงาน และคะแนนรายบุคคล
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="ปิดข้อมูลการเรียน">
            <RemixIcon icon="mingcute:close-line" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2, pb: 3 }}>
        {isLoading && (
          <Box sx={{ gap: 2, display: 'flex', flexDirection: 'column' }}>
            <Skeleton variant="rounded" height={120} />
            <Skeleton variant="rounded" height={210} />
            <Skeleton variant="rounded" height={210} />
          </Box>
        )}

        {isError && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => refetch()}>
                ลองอีกครั้ง
              </Button>
            }
          >
            ไม่สามารถโหลดข้อมูลการเรียนของนักเรียนได้
          </Alert>
        )}

        {data && (
          <Box sx={{ gap: 2.5, display: 'flex', flexDirection: 'column' }}>
            <Card variant="outlined" sx={{ p: 2.5 }}>
              <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
                <Avatar
                  sx={{
                    width: 54,
                    height: 54,
                    color: 'primary.main',
                    bgcolor: 'primary.lighter',
                    typography: 'h6',
                  }}
                >
                  {studentName.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="h6">{studentName}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    @{data.enrollment.student.username} · {data.enrollment.classroom.name}
                    {data.enrollment.student_number
                      ? ` · เลขที่ ${data.enrollment.student_number}`
                      : ''}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    ปีการศึกษา {data.enrollment.classroom.academic_years?.year ?? '-'}
                  </Typography>
                </Box>
              </Box>
            </Card>

            <Box
              sx={{
                gap: 1.5,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              }}
            >
              <ProgressSummary
                label="รายวิชาที่เรียน"
                value={`${data.subjects.length} วิชา`}
                icon="solar:gallery-wide-bold"
                color="secondary.dark"
                bgcolor="secondary.lighter"
              />
              <ProgressSummary
                label="การส่งงาน"
                value={`${submittedCount}/${assignments.length} งาน`}
                icon="solar:check-circle-bold"
                color="success.main"
                bgcolor="success.lighter"
              />
              <ProgressSummary
                label="คะแนนรวม"
                value={`${earnedScore.toLocaleString('th-TH')}/${fullScore.toLocaleString('th-TH')}`}
                icon="solar:list-bold"
                color="primary.main"
                bgcolor="primary.lighter"
              />
            </Box>

            {fullScore > 0 && (
              <Box>
                <Box sx={{ mb: 0.75, display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    คะแนนรวมทั้งหมด
                  </Typography>
                  <Typography variant="subtitle2">
                    {scorePercent.toLocaleString('th-TH', { maximumFractionDigits: 1 })}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={scorePercent}
                  sx={{ height: 8, borderRadius: 8 }}
                />
              </Box>
            )}

            {!data.subjects.length && (
              <Alert severity="info">ห้องเรียนนี้ยังไม่มีรายวิชาที่มอบหมายครูผู้สอน</Alert>
            )}

            {data.subjects.map((course) => {
              const teacherName =
                `${course.teacher.first_name ?? ''} ${course.teacher.last_name ?? ''}`.trim() ||
                course.teacher.username;
              const courseEarned = course.assignments.reduce(
                (total, item) => total + (item.score ?? 0),
                0
              );
              const courseFull = course.assignments.reduce(
                (total, item) => total + item.full_score,
                0
              );

              return (
                <Card key={course.id} variant="outlined" sx={{ overflow: 'hidden' }}>
                  <Box
                    sx={{
                      gap: 2,
                      p: 2.5,
                      display: 'flex',
                      alignItems: 'center',
                      bgcolor: 'background.neutral',
                    }}
                  >
                    <Avatar
                      variant="rounded"
                      src={course.subject.image_url ?? undefined}
                      sx={{ width: 48, height: 48, bgcolor: 'common.white' }}
                    >
                      <RemixIcon icon="solar:gallery-wide-bold" width={23} />
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle1">
                        {course.subject.code ? `${course.subject.code} · ` : ''}
                        {course.subject.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {course.semester.name} · ครู {teacherName} ·{' '}
                        {Number(course.subject.credits).toLocaleString('th-TH')} หน่วยกิต
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      variant="soft"
                      color="primary"
                      label={`${courseEarned.toLocaleString('th-TH')}/${courseFull.toLocaleString('th-TH')}`}
                    />
                  </Box>
                  <Divider />

                  {course.assignments.length ? (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>งาน</TableCell>
                            <TableCell>สถานะ</TableCell>
                            <TableCell align="right">คะแนน</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {course.assignments.map((assignment) => {
                            const status = STATUS_CONFIG[assignment.status];
                            return (
                              <TableRow key={assignment.id}>
                                <TableCell>
                                  <Typography variant="subtitle2">{assignment.title}</Typography>
                                  {assignment.feedback && (
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                      ความคิดเห็น: {assignment.feedback}
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    size="small"
                                    variant="soft"
                                    color={status.color}
                                    label={status.label}
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="subtitle2">
                                    {assignment.score === null
                                      ? '-'
                                      : assignment.score.toLocaleString('th-TH')}{' '}
                                    / {assignment.full_score.toLocaleString('th-TH')}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" sx={{ px: 2.5, py: 3, color: 'text.secondary' }}>
                      รายวิชานี้ยังไม่มีงาน
                    </Typography>
                  )}
                </Card>
              );
            })}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
