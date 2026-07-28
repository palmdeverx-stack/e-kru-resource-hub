'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDateTime } from 'src/utils/format-time';

import { toast } from 'src/components/snackbar';
import { RemixIcon } from 'src/components/remix-icon';
import { useTable, rowInPage, TablePaginationCustom } from 'src/components/table';

import { getScoreReport } from 'src/sections/teacher-assignment/score-report-actions';
import { useSchoolSubscription } from 'src/sections/school-subscription/use-school-subscription';

import { useAuthContext } from 'src/auth/hooks';

import {
  listGradeReviews,
  getGradeLineDeliveries,
  sendGradeResultsToLine,
  getGradeReviewSubmission,
} from '../grade-review-actions';

// ----------------------------------------------------------------------

const GradeResultPdfDialog = dynamic(() => import('../components/grade-result-pdf-dialog'), {
  ssr: false,
});

function fullName(person: { first_name: string | null; last_name: string | null } | null) {
  return `${person?.first_name ?? ''} ${person?.last_name ?? ''}`.trim() || '-';
}

export function GradeResultClassroomView({
  classroomId,
  semesterId,
  detailBasePath = paths.admin.gradeResults,
  summaryPath = paths.admin.gradeResults,
}: {
  classroomId: string;
  semesterId: string;
  detailBasePath?: string;
  summaryPath?: string;
}) {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const table = useTable({ defaultRowsPerPage: 10 });
  const [search, setSearch] = useState('');
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [lineHistoryOpen, setLineHistoryOpen] = useState(false);
  const [lineSelectionReady, setLineSelectionReady] = useState(false);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [pdfTeacherAssignmentId, setPdfTeacherAssignmentId] = useState<string | null>(null);
  const subscriptionQuery = useSchoolSubscription(user?.school_id);
  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['grade-reviews'],
    queryFn: listGradeReviews,
  });
  const pdfReportQuery = useQuery({
    queryKey: ['score-report', pdfTeacherAssignmentId],
    queryFn: () => getScoreReport(pdfTeacherAssignmentId!),
    enabled: Boolean(pdfTeacherAssignmentId),
  });
  const pdfSubmissionQuery = useQuery({
    queryKey: ['grade-review', pdfTeacherAssignmentId],
    queryFn: () => getGradeReviewSubmission(pdfTeacherAssignmentId!),
    enabled: Boolean(pdfTeacherAssignmentId),
  });

  const allSubjects = useMemo(
    () =>
      data.filter((item) => item.classroom?.id === classroomId && item.semester?.id === semesterId),
    [classroomId, data, semesterId]
  );
  const approvedSubjects = useMemo(
    () =>
      allSubjects.filter((item) => ['approved', 'locked'].includes(item.review?.status ?? 'draft')),
    [allSubjects]
  );
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');
    if (!keyword) return approvedSubjects;
    return approvedSubjects.filter((item) =>
      [item.subject?.code, item.subject?.name, fullName(item.teacher)]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(keyword)
    );
  }, [approvedSubjects, search]);
  const visible = useMemo(
    () => rowInPage(filtered, table.page, table.rowsPerPage),
    [filtered, table.page, table.rowsPerPage]
  );
  const firstItem = allSubjects[0];
  const firstApproved = approvedSubjects[0];
  const ready = allSubjects.length > 0 && approvedSubjects.length === allSubjects.length;
  const lockedCount = approvedSubjects.filter((item) => item.review?.status === 'locked').length;
  const lineTeacherAssignmentId = firstApproved?.id ?? null;
  const lineDeliveryQuery = useQuery({
    queryKey: ['grade-line-deliveries', lineTeacherAssignmentId],
    queryFn: () => getGradeLineDeliveries(lineTeacherAssignmentId!),
    enabled: Boolean(lineTeacherAssignmentId),
    refetchInterval: (query) => (query.state.data?.counts.pending ? 3000 : false),
  });
  useEffect(() => {
    if (!lineDialogOpen || lineSelectionReady || !lineDeliveryQuery.data) return;
    setSelectedRecipientIds(
      lineDeliveryQuery.data.recipients
        .filter((recipient) => recipient.lineConnected)
        .map((recipient) => recipient.studentId)
    );
    setLineSelectionReady(true);
  }, [lineDeliveryQuery.data, lineDialogOpen, lineSelectionReady]);
  const sendLineMutation = useMutation({
    mutationFn: () => sendGradeResultsToLine(lineTeacherAssignmentId!, selectedRecipientIds),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ['grade-line-deliveries', lineTeacherAssignmentId],
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
      setLineSelectionReady(false);
    },
  });
  const lineDeliveries = lineDeliveryQuery.data;
  const selectableRecipientIds =
    lineDeliveries?.recipients
      .filter((recipient) => recipient.lineConnected)
      .map((recipient) => recipient.studentId) ?? [];
  const allRecipientsSelected =
    selectableRecipientIds.length > 0 &&
    selectableRecipientIds.every((studentId) => selectedRecipientIds.includes(studentId));
  const someRecipientsSelected = selectedRecipientIds.length > 0 && !allRecipientsSelected;
  const canSendLine =
    user?.role === 'school_admin' || (user?.manage_permissions ?? []).includes('grades.review');
  const lineFeatureEnabled = (subscriptionQuery.data?.subscription.enabled_features ?? []).includes(
    'admin.line_notifications'
  );

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Button
        component={RouterLink}
        href={summaryPath}
        color="inherit"
        startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
        sx={{ mb: 2 }}
      >
        กลับหน้าชั้นเรียน
      </Button>

      <Box
        sx={{
          mb: 4,
          gap: 2,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            ผลการเรียน · {firstItem?.classroom?.grade_level ?? '-'}{' '}
            {firstItem?.classroom?.name ?? ''}
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            ภาคเรียนที่ {firstItem?.semester?.name ?? '-'} ปีการศึกษา{' '}
            {firstItem?.classroom?.academic_year?.year ?? '-'}
          </Typography>
        </Box>
        {ready && firstApproved ? (
          <Box sx={{ gap: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {canSendLine && (
              <Button
                variant="contained"
                color="success"
                disabled={!lineFeatureEnabled}
                title={
                  lineFeatureEnabled
                    ? 'ส่ง PDF รวมทุกวิชาแยกรายบุคคลให้ผู้ปกครอง'
                    : 'แพ็กเกจโรงเรียนยังไม่ได้เปิดความสามารถแจ้งเตือน LINE'
                }
                startIcon={<RemixIcon icon="ri:line-fill" />}
                onClick={() => {
                  setLineSelectionReady(false);
                  setLineDialogOpen(true);
                }}
              >
                ส่ง LINE ทุกวิชา
              </Button>
            )}
            <Button
              color="inherit"
              variant="outlined"
              startIcon={<RemixIcon icon="solar:history-bold" />}
              onClick={() => setLineHistoryOpen(true)}
            >
              ดูประวัติการส่ง
            </Button>
          </Box>
        ) : (
          <Button disabled variant="contained" startIcon={<RemixIcon icon="ri:line-fill" />}>
            รออนุมัติผลให้ครบทุกวิชา
          </Button>
        )}
      </Box>

      {isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              ลองอีกครั้ง
            </Button>
          }
          sx={{ mb: 3 }}
        >
          ไม่สามารถโหลดผลการเรียนของชั้นเรียนได้
        </Alert>
      )}

      {pdfTeacherAssignmentId &&
        (pdfReportQuery.isError ||
          pdfSubmissionQuery.isError ||
          (pdfSubmissionQuery.isSuccess && !pdfSubmissionQuery.data)) && (
          <Alert severity="error" onClose={() => setPdfTeacherAssignmentId(null)} sx={{ mb: 3 }}>
            ไม่สามารถเปิดใบ ปพ.5 ของรายวิชานี้ได้ กรุณาลองอีกครั้ง
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
          { label: 'นักเรียน', value: `${firstItem?.student_count ?? 0} คน` },
          { label: 'รายวิชาทั้งหมด', value: `${allSubjects.length} วิชา` },
          { label: 'อนุมัติแล้ว', value: `${approvedSubjects.length} วิชา` },
          { label: 'ปิดผลแล้ว', value: `${lockedCount} วิชา` },
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

      {!ready && !isLoading && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          ยังมีผลการเรียนรออนุมัติ {allSubjects.length - approvedSubjects.length} วิชา
          จึงยังส่งใบแจ้งผลการเรียนรวมให้ผู้ปกครองไม่ได้
        </Alert>
      )}

      {canSendLine && subscriptionQuery.isSuccess && !lineFeatureEnabled && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          ปุ่มส่ง LINE ยังใช้งานไม่ได้ เพราะแพ็กเกจโรงเรียนไม่ได้เปิดความสามารถ
          “แจ้งเตือนผู้ปกครองผ่าน LINE”
        </Alert>
      )}

      <Card variant="outlined">
        <Box
          sx={{
            p: 2.5,
            gap: 2,
            display: 'flex',
            alignItems: { xs: 'stretch', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="h6">รายวิชาที่ผ่านการอนุมัติ</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              เปิดดูและดาวน์โหลดใบ ปพ.5 ของแต่ละรายวิชาได้ทันที
            </Typography>
          </Box>
          <TextField
            size="small"
            value={search}
            placeholder="ค้นหารายวิชาหรือครูผู้สอน"
            onChange={(event) => {
              setSearch(event.target.value);
              table.onResetPage();
            }}
            sx={{ width: { xs: 1, sm: 360 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <RemixIcon icon="eva:search-fill" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        <TableContainer>
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>รายวิชา</TableCell>
                <TableCell>ครูผู้สอน</TableCell>
                <TableCell align="center">คะแนนเต็ม</TableCell>
                <TableCell>วันที่อนุมัติ</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell align="right">เอกสาร</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                      <CircularProgress size={28} />
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !filtered.length && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}
                  >
                    ไม่พบรายวิชาที่ผ่านการอนุมัติ
                  </TableCell>
                </TableRow>
              )}
              {visible.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">{item.subject?.name ?? '-'}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {item.subject?.code || 'ไม่มีรหัสวิชา'}
                    </Typography>
                  </TableCell>
                  <TableCell>{fullName(item.teacher)}</TableCell>
                  <TableCell align="center">{item.total_full_score}</TableCell>
                  <TableCell>
                    {item.review?.approved_at
                      ? fDateTime(item.review.approved_at, 'DD/MM/YYYY HH:mm')
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="soft"
                      color="success"
                      label={item.review?.status === 'locked' ? 'ปิดผลแล้ว' : 'อนุมัติแล้ว'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ gap: 1, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        component={RouterLink}
                        href={`${detailBasePath}/${item.id}`}
                        size="small"
                        color="inherit"
                        variant="outlined"
                        startIcon={<RemixIcon icon="solar:eye-bold" />}
                      >
                        ดูรายละเอียด
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        loading={
                          pdfTeacherAssignmentId === item.id &&
                          (pdfReportQuery.isLoading || pdfSubmissionQuery.isLoading)
                        }
                        onClick={() => setPdfTeacherAssignmentId(item.id)}
                        startIcon={<RemixIcon icon="solar:document-text-bold" />}
                      >
                        ดูใบ ปพ.5
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePaginationCustom
          page={table.page}
          count={filtered.length}
          rowsPerPage={table.rowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
          onPageChange={table.onChangePage}
          onRowsPerPageChange={table.onChangeRowsPerPage}
          labelRowsPerPage="แสดงต่อหน้า"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
        />
      </Card>

      {pdfTeacherAssignmentId &&
        pdfReportQuery.data &&
        pdfSubmissionQuery.data &&
        ['approved', 'locked'].includes(pdfSubmissionQuery.data.status) && (
          <GradeResultPdfDialog
            open
            report={pdfReportQuery.data}
            submission={pdfSubmissionQuery.data}
            onClose={() => setPdfTeacherAssignmentId(null)}
          />
        )}

      <Dialog
        open={lineDialogOpen}
        onClose={() => {
          if (!sendLineMutation.isPending) {
            setLineDialogOpen(false);
            setLineSelectionReady(false);
          }
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>ส่งผลการเรียนทุกวิชาทาง LINE</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            ระบบจะสร้างรูปภาพผลการเรียนรวมทุกวิชาที่อนุมัติแล้ว แยกนักเรียนหนึ่งรูปต่อคน
            และส่งเข้าแชท LINE ให้ผู้ปกครองของนักเรียนคนนั้นโดยตรง
          </Alert>
          <Typography>
            ห้อง {firstItem?.classroom?.grade_level ?? ''} {firstItem?.classroom?.name ?? ''} ·
            ภาคเรียนที่ {firstItem?.semester?.name ?? '-'} ปีการศึกษา{' '}
            {firstItem?.classroom?.academic_year?.year ?? '-'} · {approvedSubjects.length} วิชา
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            ตัวอย่างข้อมูลก่อนส่ง
          </Typography>
          {lineDeliveryQuery.isLoading && (
            <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          )}
          {lineDeliveryQuery.isError && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => lineDeliveryQuery.refetch()}>
                  ลองอีกครั้ง
                </Button>
              }
            >
              ไม่สามารถโหลดรายชื่อผู้รับได้
            </Alert>
          )}
          {lineDeliveryQuery.isSuccess && (
            <>
              <Box sx={{ mb: 1.5, gap: 1, display: 'flex', flexWrap: 'wrap' }}>
                <Chip
                  size="small"
                  variant="soft"
                  label={`นักเรียน ${lineDeliveries?.eligibleStudents ?? 0} คน`}
                />
                <Chip
                  size="small"
                  variant="soft"
                  color="success"
                  label={`เลือกส่ง ${selectedRecipientIds.length}/${
                    lineDeliveries?.linkedStudents ?? 0
                  } คน`}
                />
                <Chip
                  size="small"
                  variant="soft"
                  color="warning"
                  label={`ยังไม่เชื่อม LINE ${
                    (lineDeliveries?.eligibleStudents ?? 0) - (lineDeliveries?.linkedStudents ?? 0)
                  } คน`}
                />
                <Button
                  size="small"
                  color="inherit"
                  disabled={!selectableRecipientIds.length || sendLineMutation.isPending}
                  onClick={() =>
                    setSelectedRecipientIds(allRecipientsSelected ? [] : selectableRecipientIds)
                  }
                >
                  {allRecipientsSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                </Button>
              </Box>
              <TableContainer sx={{ maxHeight: 320, border: 1, borderColor: 'divider' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={allRecipientsSelected}
                          indeterminate={someRecipientsSelected}
                          disabled={!selectableRecipientIds.length || sendLineMutation.isPending}
                          onChange={() =>
                            setSelectedRecipientIds(
                              allRecipientsSelected ? [] : selectableRecipientIds
                            )
                          }
                          inputProps={{ 'aria-label': 'เลือกนักเรียนทั้งหมดที่พร้อมส่ง LINE' }}
                        />
                      </TableCell>
                      <TableCell>นักเรียน</TableCell>
                      <TableCell>ผู้ปกครอง</TableCell>
                      <TableCell>การส่ง LINE</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lineDeliveries?.recipients.map((recipient) => (
                      <TableRow key={recipient.studentId}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedRecipientIds.includes(recipient.studentId)}
                            disabled={!recipient.lineConnected || sendLineMutation.isPending}
                            onChange={() =>
                              setSelectedRecipientIds((current) =>
                                current.includes(recipient.studentId)
                                  ? current.filter((studentId) => studentId !== recipient.studentId)
                                  : [...current, recipient.studentId]
                              )
                            }
                            inputProps={{
                              'aria-label': `เลือกส่งผลการเรียนให้ ${recipient.studentName}`,
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          {recipient.studentName}
                          {recipient.studentCode ? ` (${recipient.studentCode})` : ''}
                        </TableCell>
                        <TableCell>{recipient.guardianName ?? 'ยังไม่มีข้อมูลผู้ปกครอง'}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="soft"
                            color={recipient.lineConnected ? 'success' : 'warning'}
                            label={recipient.lineConnected ? 'พร้อมส่ง' : 'ไม่ส่ง'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {!lineDeliveries?.recipients.length && (
                      <TableRow>
                        <TableCell colSpan={4} sx={{ py: 4, textAlign: 'center' }}>
                          ไม่พบนักเรียนในชั้นเรียนนี้
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
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
            onClick={() => {
              setLineDialogOpen(false);
              setLineSelectionReady(false);
            }}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            color="success"
            disabled={
              sendLineMutation.isPending ||
              !lineFeatureEnabled ||
              lineDeliveryQuery.isLoading ||
              lineDeliveryQuery.isError ||
              !selectedRecipientIds.length
            }
            startIcon={
              sendLineMutation.isPending ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <RemixIcon icon="ri:line-fill" />
              )
            }
            onClick={() => sendLineMutation.mutate()}
          >
            ส่ง LINE ที่เลือก {selectedRecipientIds.length} คน
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={lineHistoryOpen}
        onClose={() => setLineHistoryOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>ประวัติการส่งผลการเรียนทาง LINE</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, gap: 1, display: 'flex', flexWrap: 'wrap' }}>
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

          {lineDeliveryQuery.isLoading && (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          )}
          {lineDeliveryQuery.isError && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => lineDeliveryQuery.refetch()}>
                  ลองอีกครั้ง
                </Button>
              }
            >
              ไม่สามารถโหลดประวัติการส่ง LINE ได้
            </Alert>
          )}
          {lineDeliveryQuery.isSuccess && !lineDeliveries?.deliveries.length && (
            <Alert severity="info">ยังไม่มีประวัติการส่งผลการเรียนของชั้นเรียนนี้</Alert>
          )}
          {!!lineDeliveries?.deliveries.length && (
            <TableContainer>
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
                  {lineDeliveries.deliveries.map((delivery) => {
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
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setLineHistoryOpen(false)}>
            ปิด
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
