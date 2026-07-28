'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { toast } from 'src/components/snackbar';
import { RemixIcon } from 'src/components/remix-icon';

import { getScoreReport } from 'src/sections/teacher-assignment/score-report-actions';
import { useSchoolSubscription } from 'src/sections/school-subscription/use-school-subscription';

import { useAuthContext } from 'src/auth/hooks';

import { buildGradeResultRows } from '../grade-result-utils';
import {
  getGradeLineDeliveries,
  sendGradeResultsToLine,
  getGradeReviewSubmission,
} from '../grade-review-actions';

// ----------------------------------------------------------------------

const GradeResultPdfDialog = dynamic(() => import('../components/grade-result-pdf-dialog'), {
  ssr: false,
});

export function GradeResultDetailView({
  teacherAssignmentId,
  backPath = paths.admin.gradeResults,
}: {
  teacherAssignmentId: string;
  backPath?: string;
}) {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const [pdfOpen, setPdfOpen] = useState(false);
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const subscriptionQuery = useSchoolSubscription(user?.school_id);
  const reportQuery = useQuery({
    queryKey: ['score-report', teacherAssignmentId],
    queryFn: () => getScoreReport(teacherAssignmentId),
  });
  const submissionQuery = useQuery({
    queryKey: ['grade-review', teacherAssignmentId],
    queryFn: () => getGradeReviewSubmission(teacherAssignmentId),
  });
  const lineDeliveryQuery = useQuery({
    queryKey: ['grade-line-deliveries', teacherAssignmentId],
    queryFn: () => getGradeLineDeliveries(teacherAssignmentId),
    refetchInterval: (query) => (query.state.data?.counts.pending ? 3000 : false),
  });
  const sendLineMutation = useMutation({
    mutationFn: () => sendGradeResultsToLine(teacherAssignmentId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ['grade-line-deliveries', teacherAssignmentId],
      });
      if (!result.counts.total) {
        toast.warning(
          `ไม่พบผู้ปกครองที่เชื่อม LINE (${result.linkedStudents}/${result.eligibleStudents} นักเรียน)`
        );
      } else if (result.counts.sent === result.counts.total) {
        toast.success(`ส่งใบแจ้งผลการเรียน PDF สำเร็จ ${result.counts.sent} รายการ`);
      } else {
        toast.success(`นำใบแจ้งผลการเรียน PDF เข้าคิว LINE ${result.counts.total} รายการแล้ว`);
      }
      setLineDialogOpen(false);
    },
  });
  const rows = useMemo(
    () => (reportQuery.data ? buildGradeResultRows(reportQuery.data) : []),
    [reportQuery.data]
  );
  const average = rows.length
    ? rows.reduce((total, row) => total + row.normalized, 0) / rows.length
    : 0;
  const passed = rows.filter((row) => row.normalized >= 50).length;
  const report = reportQuery.data;
  const submission = submissionQuery.data;
  const lineDeliveries = lineDeliveryQuery.data;
  const canSendLine =
    user?.role === 'school_admin' || (user?.manage_permissions ?? []).includes('grades.review');
  const lineFeatureEnabled = (
    subscriptionQuery.data?.subscription.enabled_features ?? []
  ).includes('admin.line_notifications');
  const resolvedBackPath = report
    ? `${backPath}/classroom/${report.classroom.id}/${report.semesterId}`
    : backPath;

  if (reportQuery.isLoading || submissionQuery.isLoading) {
    return (
      <Box sx={{ py: 12, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (
    !report ||
    !submission ||
    !['approved', 'locked'].includes(submission.status) ||
    reportQuery.isError ||
    submissionQuery.isError
  ) {
    return (
      <Container maxWidth="md">
        <Alert
          severity="warning"
          action={
            <Button component={RouterLink} href={backPath} color="inherit">
              กลับหน้าผลการเรียน
            </Button>
          }
        >
          ผลการเรียนนี้ยังไม่ผ่านการตรวจสอบและอนุมัติ
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ pb: 6 }}>
      <Button
        component={RouterLink}
        href={resolvedBackPath}
        color="inherit"
        startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
        sx={{ mb: 2 }}
      >
        กลับหน้าผลการเรียน
      </Button>

      <Box
        sx={{
          mb: 3,
          gap: 2,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            ผลการเรียน · {report.subject.name}
          </Typography>
          <Typography sx={{ mt: 0.75, color: 'text.secondary' }}>
            {report.subject.code || 'ไม่มีรหัสวิชา'} · ห้อง {report.classroom.name} · ภาคเรียนที่{' '}
            {report.semesterName} ปีการศึกษา {report.classroom.academicYear}
          </Typography>
        </Box>
        <Box sx={{ gap: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {canSendLine && (
            <Button
              variant="outlined"
              color="success"
              disabled={!lineFeatureEnabled}
              title={
                lineFeatureEnabled
                  ? 'ส่งใบแจ้งผลการเรียนรวมทุกวิชาให้ผู้ปกครอง'
                  : 'แพ็กเกจโรงเรียนยังไม่ได้เปิดความสามารถแจ้งเตือน LINE'
              }
              startIcon={<RemixIcon icon="ri:line-fill" />}
              onClick={() => setLineDialogOpen(true)}
            >
              ส่งทุกวิชาเป็น PDF ทาง LINE
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<RemixIcon icon="solar:document-bold" />}
            onClick={() => setPdfOpen(true)}
          >
            พรีวิว / ดาวน์โหลดใบ ปพ.5
          </Button>
        </Box>
      </Box>

      {canSendLine && subscriptionQuery.isSuccess && !lineFeatureEnabled && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          ปุ่มส่ง LINE ยังใช้งานไม่ได้ เพราะแพ็กเกจโรงเรียนไม่ได้เปิดความสามารถ
          “แจ้งเตือนผู้ปกครองผ่าน LINE”
        </Alert>
      )}

      <Box
        sx={{
          mb: 3,
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        }}
      >
        {[
          { label: 'นักเรียนทั้งหมด', value: `${rows.length} คน` },
          { label: 'คะแนนเฉลี่ย', value: average.toFixed(2) },
          { label: 'ผ่านเกณฑ์', value: `${passed} คน` },
          { label: 'ไม่ผ่านเกณฑ์', value: `${rows.length - passed} คน` },
        ].map((item) => (
          <Card key={item.label} variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {item.label}
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>
              {item.value}
            </Typography>
          </Card>
        ))}
      </Box>

      {(canSendLine || (lineDeliveries?.counts.total ?? 0) > 0) && (
        <Card variant="outlined" sx={{ mb: 3, p: 2.5 }}>
          <Box
            sx={{
              gap: 2,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="h6">การส่งใบแจ้งผลการเรียนรวมทาง LINE</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                รูปภาพผลการเรียนรวมทุกวิชาของนักเรียนในห้องและภาคเรียนนี้
              </Typography>
            </Box>
            <Box sx={{ gap: 1, display: 'flex', flexWrap: 'wrap' }}>
              <Chip
                size="small"
                variant="soft"
                color="success"
                label={`สำเร็จ ${lineDeliveries?.counts.sent ?? 0}`}
              />
              <Chip
                size="small"
                variant="soft"
                color="info"
                label={`รอส่ง ${lineDeliveries?.counts.pending ?? 0}`}
              />
              <Chip
                size="small"
                variant="soft"
                color="error"
                label={`ไม่สำเร็จ ${
                  (lineDeliveries?.counts.failed ?? 0) + (lineDeliveries?.counts.skipped ?? 0)
                }`}
              />
            </Box>
          </Box>

          {!!lineDeliveries?.deliveries.length && (
            <TableContainer sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>นักเรียน</TableCell>
                    <TableCell>ผู้ปกครอง</TableCell>
                    <TableCell>สถานะ</TableCell>
                    <TableCell>เวลาส่ง</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lineDeliveries.deliveries.slice(0, 10).map((delivery) => {
                    const status = {
                      sent: { label: 'ส่งสำเร็จ', color: 'success' as const },
                      pending: { label: 'รอส่ง', color: 'info' as const },
                      processing: { label: 'กำลังส่ง', color: 'info' as const },
                      failed: { label: 'ส่งไม่สำเร็จ', color: 'error' as const },
                      skipped: { label: 'ข้ามรายการ', color: 'warning' as const },
                    }[delivery.status];
                    return (
                      <TableRow key={delivery.id}>
                        <TableCell>
                          {delivery.studentName}
                          {delivery.studentCode ? ` (${delivery.studentCode})` : ''}
                        </TableCell>
                        <TableCell>{delivery.guardianName}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="soft"
                            color={status.color}
                            label={status.label}
                          />
                        </TableCell>
                        <TableCell>
                          {delivery.sentAt
                            ? new Intl.DateTimeFormat('th-TH', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              }).format(new Date(delivery.sentAt))
                            : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      )}

      <Card variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6">รายละเอียดแบบ ปพ.5</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              คะแนนรวมถูกปรับเป็นฐาน 100 และคำนวณระดับผลการเรียน
            </Typography>
          </Box>
          <Chip
            variant="soft"
            color="success"
            label={submission.status === 'locked' ? 'ปิดผลการเรียนแล้ว' : 'อนุมัติแล้ว'}
          />
        </Box>
        <TableContainer>
          <Table sx={{ minWidth: 1100 }}>
            <TableHead>
              <TableRow>
                <TableCell>เลขที่</TableCell>
                <TableCell>รหัสนักเรียน</TableCell>
                <TableCell>ชื่อ-นามสกุล</TableCell>
                <TableCell align="right">งาน</TableCell>
                <TableCell align="right">แบบทดสอบ</TableCell>
                <TableCell align="right">กลางภาค</TableCell>
                <TableCell align="right">ปลายภาค</TableCell>
                <TableCell align="right">อื่น ๆ</TableCell>
                <TableCell align="right">รวม/100</TableCell>
                <TableCell align="center">ผลการเรียน</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.student.id} hover>
                  <TableCell>{row.student.studentNumber ?? index + 1}</TableCell>
                  <TableCell>{row.student.studentCode ?? '-'}</TableCell>
                  <TableCell>
                    {`${row.student.firstName ?? ''} ${row.student.lastName ?? ''}`.trim() ||
                      row.student.username}
                  </TableCell>
                  <TableCell align="right">{row.categoryScores.assignment.toFixed(2)}</TableCell>
                  <TableCell align="right">{row.categoryScores.quiz.toFixed(2)}</TableCell>
                  <TableCell align="right">{row.categoryScores.midterm.toFixed(2)}</TableCell>
                  <TableCell align="right">{row.categoryScores.final.toFixed(2)}</TableCell>
                  <TableCell align="right">{row.categoryScores.other.toFixed(2)}</TableCell>
                  <TableCell align="right">{row.normalized.toFixed(2)}</TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      variant="soft"
                      color={
                        row.student.specialResult
                          ? 'warning'
                          : row.normalized >= 50
                            ? 'success'
                            : 'error'
                      }
                      label={row.grade}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {pdfOpen && (
        <GradeResultPdfDialog
          open
          onClose={() => setPdfOpen(false)}
          report={report}
          submission={submission}
        />
      )}

      <Dialog
        open={lineDialogOpen}
        onClose={() => !sendLineMutation.isPending && setLineDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>ยืนยันส่งใบแจ้งผลการเรียนรวมทุกวิชา</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            ระบบจะสร้างรูปภาพใบแจ้งผลการเรียนแยกนักเรียนหนึ่งรูปต่อคน
            และส่งเข้าแชท LINE ให้ผู้ปกครองที่เชื่อม LINE ไว้โดยตรง ไม่ต้องกดลิงก์
          </Alert>
          <Typography>
            ห้อง {report.classroom.gradeLevel ?? ''} {report.classroom.name} · ภาคเรียนที่{' '}
            {report.semesterName} ปีการศึกษา {report.classroom.academicYear} ·
            รวมทุกวิชาที่อนุมัติแล้ว
          </Typography>
          {(lineDeliveries?.counts.sent ?? 0) > 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              ส่งสำเร็จแล้ว {lineDeliveries?.counts.sent} รายการ ระบบจะไม่ส่งซ้ำให้ผู้ปกครองเดิม
            </Alert>
          )}
          {sendLineMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {sendLineMutation.error instanceof Error
                ? sendLineMutation.error.message
                : 'ส่งผลการเรียนไม่สำเร็จ'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            disabled={sendLineMutation.isPending}
            onClick={() => setLineDialogOpen(false)}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            color="success"
            disabled={sendLineMutation.isPending || !lineFeatureEnabled}
            startIcon={
              sendLineMutation.isPending ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <RemixIcon icon="ri:line-fill" />
              )
            }
            onClick={() => sendLineMutation.mutate()}
          >
            สร้าง PDF และส่ง LINE
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
