'use client';

import type { SubmissionStatus } from 'src/sections/gradebook/gradebook-actions';
import type { AssignmentCategory } from 'src/sections/assignment/assignment-actions';

import { varAlpha } from 'minimal-shared/utils';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
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
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import LinearProgress from '@mui/material/LinearProgress';
import TableContainer from '@mui/material/TableContainer';

import { Label } from 'src/components/label';
import { RemixIcon } from 'src/components/remix-icon';

import { getStudentBreakdown } from '../teacher-assignment-actions';

// ----------------------------------------------------------------------

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  submitted: 'ส่งแล้ว',
  late: 'ส่งช้า',
  not_submitted: 'ยังไม่ส่ง',
  absent: 'ขาดสอบ',
  sick_leave: 'ลาป่วย',
  pending_review: 'รอตรวจ',
};

const STATUS_COLOR: Record<SubmissionStatus, 'success' | 'warning' | 'error' | 'info' | 'default'> =
  {
    submitted: 'success',
    late: 'warning',
    not_submitted: 'error',
    absent: 'error',
    sick_leave: 'info',
    pending_review: 'default',
  };

const CATEGORY_LABEL: Record<AssignmentCategory, string> = {
  assignment: 'งาน',
  quiz: 'แบบทดสอบ',
  midterm: 'กลางภาค',
  final: 'ปลายภาค',
  other: 'คะแนนอื่นๆ',
};

type Props = {
  teacherAssignmentId: string;
  studentId: string | null;
  onClose: () => void;
};

export function StudentBreakdownDialog({ teacherAssignmentId, studentId, onClose }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['student-breakdown', teacherAssignmentId, studentId],
    queryFn: () => getStudentBreakdown(teacherAssignmentId, studentId!),
    enabled: !!studentId,
  });

  const studentName = data
    ? `${data.student.first_name ?? ''} ${data.student.last_name ?? ''}`.trim() ||
      data.student.username
    : 'รายละเอียดนักเรียน';
  const notSubmittedCount =
    data?.rows.filter((row) => row.score.status === 'not_submitted').length ?? 0;
  const gradedCount = data?.rows.filter((row) => row.score.score !== null).length ?? 0;
  const totalScore = data?.rows.reduce((sum, row) => sum + (row.score.score ?? 0), 0) ?? 0;
  const totalFullScore = data?.rows.reduce((sum, row) => sum + row.assignment.full_score, 0) ?? 0;
  const scorePercent = totalFullScore ? Math.min((totalScore / totalFullScore) * 100, 100) : 0;

  return (
    <Dialog
      open={!!studentId}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { maxHeight: '92vh', overflow: 'hidden' } } }}
    >
      <DialogTitle
        sx={{
          p: { xs: 2.5, sm: 3 },
          color: 'primary.contrastText',
          background: (theme) =>
            `linear-gradient(135deg, ${theme.vars.palette.primary.darker}, ${theme.vars.palette.primary.main})`,
        }}
      >
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          <Avatar
            src={data?.student.avatar_url ?? undefined}
            sx={{
              width: 56,
              height: 56,
              typography: 'h5',
              color: 'primary.main',
              bgcolor: 'common.white',
              border: (theme) =>
                `2px solid ${varAlpha(theme.vars.palette.common.whiteChannel, 0.48)}`,
            }}
          >
            {studentName.charAt(0)}
          </Avatar>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="overline" sx={{ opacity: 0.72 }}>
              ผลการเรียนรายบุคคล
            </Typography>
            {isLoading ? (
              <Skeleton width={220} sx={{ bgcolor: 'primary.light' }} />
            ) : (
              <Typography variant="h5" noWrap>
                {studentName}
              </Typography>
            )}
            {data && (
              <Typography variant="body2" sx={{ mt: 0.25, opacity: 0.8 }}>
                เลขที่ {data.student.student_number ?? '-'} · @{data.student.username}
              </Typography>
            )}
          </Box>
          <IconButton
            color="inherit"
            aria-label="ปิดหน้าต่าง"
            onClick={onClose}
            sx={{ alignSelf: 'flex-start' }}
          >
            <RemixIcon icon="mingcute:close-line" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 2, sm: 3 }, mt: 2 }}>
        {isLoading && <BreakdownLoading />}

        {isError && (
          <Alert severity="error">โหลดรายละเอียดนักเรียนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</Alert>
        )}

        {!isLoading && data && (
          <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
            <Box
              sx={{
                gap: 1.5,
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
              }}
            >
              <SummaryCard
                label="คะแนนรวม"
                value={`${totalScore}/${totalFullScore}`}
                icon="solar:cup-star-bold"
                highlight
              />
              <SummaryCard
                label="ให้คะแนนแล้ว"
                value={`${gradedCount}/${data.rows.length}`}
                icon="solar:check-circle-bold"
              />
              <SummaryCard
                label="ยังไม่ส่ง"
                value={`${notSubmittedCount} รายการ`}
                icon="solar:danger-triangle-bold"
                fullWidthMobile
              />
            </Box>

            <Card variant="outlined" sx={{ p: 2 }}>
              <Box
                sx={{
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Typography variant="subtitle2">คะแนนคิดเป็น</Typography>
                <Typography variant="subtitle1" sx={{ color: 'primary.main' }}>
                  {scorePercent.toFixed(1)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={scorePercent}
                sx={{ height: 9, borderRadius: 1 }}
              />
            </Card>

            <Box>
              <Typography variant="h6">รายละเอียดคะแนน</Typography>
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                คะแนน สถานะการส่ง และความคิดเห็นในแต่ละรายการ
              </Typography>

              {!data.rows.length && (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <RemixIcon icon="solar:inbox-bold" width={42} sx={{ color: 'text.disabled' }} />
                  <Typography variant="subtitle2" sx={{ mt: 1 }}>
                    ยังไม่มีรายการคะแนนในวิชานี้
                  </Typography>
                </Box>
              )}

              {!!data.rows.length && (
                <>
                  <TableContainer
                    sx={{
                      display: { xs: 'none', sm: 'block' },
                      borderRadius: 1.5,
                      border: (theme) => `1px solid ${theme.vars.palette.divider}`,
                    }}
                  >
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>รายการ</TableCell>
                          <TableCell>ประเภท</TableCell>
                          <TableCell>สถานะ</TableCell>
                          <TableCell align="right">คะแนน</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.rows.map((row) => (
                          <TableRow key={row.assignment.id} hover>
                            <TableCell>
                              <Typography variant="subtitle2">{row.assignment.title}</Typography>
                              {row.score.feedback && (
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  {row.score.feedback}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>{CATEGORY_LABEL[row.assignment.category]}</TableCell>
                            <TableCell>
                              <Label variant="soft" color={STATUS_COLOR[row.score.status]}>
                                {STATUS_LABEL[row.score.status]}
                              </Label>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="subtitle2">
                                {row.score.score ?? '-'} / {row.assignment.full_score}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Box sx={{ gap: 1.5, display: { xs: 'grid', sm: 'none' } }}>
                    {data.rows.map((row) => (
                      <Card key={row.assignment.id} variant="outlined" sx={{ p: 2 }}>
                        <Box sx={{ gap: 1, display: 'flex', alignItems: 'flex-start' }}>
                          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                            <Typography variant="subtitle2">{row.assignment.title}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {CATEGORY_LABEL[row.assignment.category]}
                            </Typography>
                          </Box>
                          <Typography variant="h6" sx={{ color: 'primary.main' }}>
                            {row.score.score ?? '-'}
                            <Typography
                              component="span"
                              variant="caption"
                              sx={{ color: 'text.secondary' }}
                            >
                              /{row.assignment.full_score}
                            </Typography>
                          </Typography>
                        </Box>
                        <Divider sx={{ my: 1.5 }} />
                        <Box
                          sx={{
                            gap: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Label variant="soft" color={STATUS_COLOR[row.score.status]}>
                            {STATUS_LABEL[row.score.status]}
                          </Label>
                          {row.score.feedback && (
                            <Typography
                              variant="caption"
                              sx={{ textAlign: 'right', color: 'text.secondary' }}
                            >
                              {row.score.feedback}
                            </Typography>
                          )}
                        </Box>
                      </Card>
                    ))}
                  </Box>
                </>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions
        sx={{ px: 3, py: 2, borderTop: (theme) => `1px solid ${theme.vars.palette.divider}` }}
      >
        <Button variant="outlined" color="inherit" onClick={onClose}>
          ปิด
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

type SummaryCardProps = {
  label: string;
  value: string;
  icon: 'solar:cup-star-bold' | 'solar:check-circle-bold' | 'solar:danger-triangle-bold';
  highlight?: boolean;
  fullWidthMobile?: boolean;
};

function SummaryCard({ label, value, icon, highlight, fullWidthMobile }: SummaryCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        p: 2,
        gap: 1.5,
        display: 'flex',
        alignItems: 'center',
        gridColumn: { xs: fullWidthMobile ? '1 / -1' : 'auto', sm: 'auto' },
        borderColor: highlight ? 'primary.main' : 'divider',
        bgcolor: (theme) =>
          highlight ? varAlpha(theme.vars.palette.primary.mainChannel, 0.06) : 'background.paper',
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          display: 'grid',
          flexShrink: 0,
          borderRadius: 1.25,
          color: highlight ? 'primary.main' : 'text.secondary',
          placeItems: 'center',
          bgcolor: (theme) =>
            varAlpha(theme.vars.palette.primary.mainChannel, highlight ? 0.14 : 0.07),
        }}
      >
        <RemixIcon icon={icon} width={22} />
      </Box>
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        <Typography variant="h6">{value}</Typography>
      </Box>
    </Card>
  );
}

function BreakdownLoading() {
  return (
    <Box sx={{ gap: 2, display: 'grid' }}>
      <Box sx={{ gap: 1.5, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} variant="rounded" height={82} />
        ))}
      </Box>
      <Skeleton variant="rounded" height={64} />
      <Skeleton variant="rounded" height={220} />
    </Box>
  );
}
