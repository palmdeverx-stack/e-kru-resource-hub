'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDateTime } from 'src/utils/format-time';

import { RemixIcon } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { SignaturePad } from '../components/signature-pad';
import { ScheduleGrid } from '../../schedule-builder/components/schedule-grid';
import { getClassroomSchedule } from '../../schedule-builder/schedule-builder-actions';
import { approveClassroomSchedule, getScheduleApprovalDetail } from '../schedule-approvals-actions';

// ----------------------------------------------------------------------

const ScheduleApprovalPdfDialog = dynamic(
  () => import('../components/schedule-approval-pdf-dialog'),
  { ssr: false }
);

function fullName(person: { first_name: string | null; last_name: string | null } | null) {
  return `${person?.first_name ?? ''} ${person?.last_name ?? ''}`.trim() || 'ไม่ทราบชื่อ';
}

const STATUS = {
  submitted: { label: 'รออนุมัติ', color: 'warning' },
  approved: { label: 'อนุมัติแล้ว', color: 'success' },
  canceled: { label: 'ยกเลิกแล้ว', color: 'default' },
} as const;

type Props = {
  approvalId: string;
  readOnly?: boolean;
  backPath?: string;
};

export function ScheduleApprovalDetailView({
  approvalId,
  readOnly = false,
  backPath = paths.admin.scheduleApprovals,
}: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const isReadOnly =
    readOnly ||
    (user?.role === 'teacher' &&
      !(user?.manage_permissions ?? []).includes('schedule.approve'));
  const [signature, setSignature] = useState('');
  const [pdfOpen, setPdfOpen] = useState(false);

  const approvalQuery = useQuery({
    queryKey: ['schedule-approval', approvalId],
    queryFn: () => getScheduleApprovalDetail(approvalId),
  });
  const approval = approvalQuery.data;

  const scheduleQuery = useQuery({
    queryKey: ['classroom-schedule', approval?.classroom?.id, approval?.semester?.id],
    queryFn: () => getClassroomSchedule(approval!.classroom!.id, approval!.semester!.id),
    enabled: !!approval?.classroom?.id && !!approval?.semester?.id,
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      approveClassroomSchedule(approval!.classroom!.id, approval!.semester!.id, signature),
    onSuccess: async () => {
      setSignature('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['schedule-approval', approvalId] }),
        queryClient.invalidateQueries({ queryKey: ['schedule-approvals'] }),
      ]);
    },
  });

  const directorName =
    `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || user?.username || 'ผู้อำนวยการ';
  const homeroomNames = useMemo(
    () =>
      (approval?.classroom?.homeroom_teachers ?? [])
        .map((entry) => fullName(entry.teacher))
        .join(', ') || 'ยังไม่กำหนด',
    [approval]
  );
  const pdfSignature = approval?.signature_url ?? signature;

  if (approvalQuery.isLoading) {
    return (
      <Box sx={{ py: 12, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (approvalQuery.isError || !approval) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert
          severity="error"
          action={
            <Button component={RouterLink} href={backPath} color="inherit">
              กลับหน้ารายการ
            </Button>
          }
        >
          {approvalQuery.error?.message ?? 'ไม่พบรายการอนุมัตินี้'}
        </Alert>
      </Container>
    );
  }

  const status = STATUS[approval.status];
  const actionPerson =
    approval.status === 'approved'
      ? approval.approved_by
      : approval.status === 'canceled'
        ? approval.canceled_by
        : approval.submitted_by;
  const actionDate =
    approval.status === 'approved'
      ? approval.approved_at
      : approval.status === 'canceled'
        ? approval.canceled_at
        : approval.submitted_at;

  return (
    <Container maxWidth={false} sx={{ pb: 6 }}>
      <Button
        component={RouterLink}
        href={backPath}
        color="inherit"
        startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
        sx={{ mb: 2 }}
      >
        กลับหน้ารายการ
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
          <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography component="h1" variant="h3">
              ตรวจสอบตารางเรียน
            </Typography>
            <Chip size="small" variant="soft" color={status.color} label={status.label} />
          </Box>
          <Typography sx={{ mt: 0.75, color: 'text.secondary' }}>
            ชั้น {approval.classroom?.grade_level ?? '-'} {approval.classroom?.name ?? ''}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          disabled={!scheduleQuery.data}
          startIcon={<RemixIcon icon="solar:document-bold" />}
          onClick={() => setPdfOpen(true)}
        >
          พรีวิว / ดาวน์โหลด PDF
        </Button>
      </Box>

      {approveMutation.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {approveMutation.error.message}
        </Alert>
      )}

      <Card variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Box
          sx={{
            gap: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          }}
        >
          {[
            {
              icon: 'solar:user-id-bold-duotone',
              label: 'ครูประจำชั้น',
              value: homeroomNames,
            },
            {
              icon: 'solar:notebook-bold-duotone',
              label: 'ปีการศึกษา / ภาคเรียน',
              value: `${approval.semester?.academic_year?.year ?? '-'} / ${approval.semester?.name ?? '-'}`,
            },
            {
              icon: 'solar:user-check-bold-duotone',
              label:
                approval.status === 'approved'
                  ? 'ผู้อนุมัติ'
                  : approval.status === 'canceled'
                    ? 'ผู้ยกเลิก'
                    : 'ผู้ส่งตรวจ',
              value: fullName(actionPerson),
            },
            {
              icon: 'solar:clock-circle-bold-duotone',
              label:
                approval.status === 'approved'
                  ? 'วันที่อนุมัติ'
                  : approval.status === 'canceled'
                    ? 'วันที่ยกเลิก'
                    : 'วันที่ส่ง',
              value: actionDate ? fDateTime(actionDate, 'DD/MM/YYYY HH:mm') : '-',
            },
          ].map((item) => (
            <Box key={item.label} sx={{ gap: 1.5, minWidth: 0, display: 'flex' }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  flexShrink: 0,
                  display: 'grid',
                  borderRadius: 1.5,
                  placeItems: 'center',
                  color: 'primary.main',
                  bgcolor: 'primary.lighter',
                }}
              >
                <RemixIcon icon={item.icon} width={22} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {item.label}
                </Typography>
                <Typography variant="subtitle2">{item.value}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Card>

      <Card variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <Box
          sx={{
            mb: 2,
            gap: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="h6">ตารางเรียนประจำสัปดาห์</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              ตรวจสอบรายวิชา ครูผู้สอน วันและเวลาให้ครบถ้วน
            </Typography>
          </Box>
          {scheduleQuery.data && (
            <Chip
              size="small"
              variant="outlined"
              label={`${scheduleQuery.data.schedules.length} คาบ`}
            />
          )}
        </Box>
        {scheduleQuery.isLoading && (
          <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        )}
        {scheduleQuery.isError && <Alert severity="error">ไม่สามารถโหลดตารางเรียนได้</Alert>}
        {scheduleQuery.data && (
          <ScheduleGrid
            schedules={scheduleQuery.data.schedules}
            assignments={scheduleQuery.data.assignments}
            periods={scheduleQuery.data.periods}
            scheduleMode={scheduleQuery.data.scheduleMode}
          />
        )}
      </Card>

      <Card variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6">ลายเซ็นรับรองตามลำดับ</Typography>
          <Typography variant="body2" sx={{ mt: 0.5, mb: 2.5, color: 'text.secondary' }}>
            {approval.status === 'submitted'
              ? 'ผู้จัดทำลงนามแล้ว กรุณาตรวจสอบและลงลายเซ็นผู้อำนวยการเพื่ออนุมัติ'
              : approval.status === 'approved'
                ? 'เอกสารนี้ลงนามครบทั้งผู้จัดทำและผู้อำนวยการแล้ว'
                : 'รายการนี้ถูกยกเลิกก่อนการอนุมัติ'}
          </Typography>

          <Box sx={{ gap: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.neutral' }}>
              <Typography variant="subtitle1">1. ผู้จัดทำตารางเรียน</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {fullName(approval.submitted_by)} ·{' '}
                {approval.submitted_by?.position_title || 'ผู้จัดทำตารางเรียน'}
              </Typography>
              {approval.submitter_signature_url ? (
                <Box
                  component="img"
                  src={approval.submitter_signature_url}
                  alt={`ลายเซ็นของ ${fullName(approval.submitted_by)}`}
                  sx={{ mt: 1.5, width: 320, maxWidth: 1, height: 160, objectFit: 'contain' }}
                />
              ) : (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  รายการเก่านี้ไม่มีลายเซ็นผู้จัดทำ
                </Alert>
              )}
            </Box>

            <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.neutral' }}>
              <Typography variant="subtitle1">2. ผู้อำนวยการ</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {approval.status === 'approved'
                  ? fullName(approval.approved_by)
                  : isReadOnly
                    ? 'รอผู้อำนวยการลงลายเซ็น'
                    : `${directorName} · รอลงลายเซ็น`}
              </Typography>
              {approval.status === 'submitted' && !isReadOnly && (
                <Box sx={{ mt: 1.5 }}>
                  <SignaturePad
                    value={signature}
                    onChange={setSignature}
                    disabled={approveMutation.isPending}
                  />
                </Box>
              )}
              {approval.status === 'submitted' && isReadOnly && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  รอผู้อำนวยการตรวจสอบและลงลายเซ็น
                </Alert>
              )}
              {approval.status === 'approved' && approval.signature_url && (
                <Box
                  component="img"
                  src={approval.signature_url}
                  alt={`ลายเซ็นของ ${fullName(approval.approved_by)}`}
                  sx={{ mt: 1.5, width: 320, maxWidth: 1, height: 160, objectFit: 'contain' }}
                />
              )}
              {approval.status === 'approved' && !approval.signature_url && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  รายการเก่านี้ไม่มีลายเซ็นผู้อำนวยการ
                </Alert>
              )}
              {approval.status === 'canceled' && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  รายการถูกยกเลิกก่อนผู้อำนวยการลงนาม
                </Alert>
              )}
            </Box>
          </Box>
        </Box>

        <Divider />

        <Box
          sx={{
            p: { xs: 2, md: 3 },
            gap: 2,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: 'background.neutral',
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              สถานะลายเซ็นผู้อำนวยการ
            </Typography>
            <Typography variant="subtitle2">
              {approval.status === 'approved'
                ? `${fullName(approval.approved_by)} · ลงนามแล้ว`
                : approval.status === 'canceled'
                  ? 'ยกเลิกก่อนลงนาม'
                  : isReadOnly
                    ? 'รอลงนาม'
                    : `${directorName} · รอลงนาม`}
            </Typography>
          </Box>
          {approval.status === 'submitted' && !isReadOnly && (
            <Button
              size="large"
              color="success"
              variant="contained"
              loading={approveMutation.isPending}
              disabled={!signature || !scheduleQuery.data || !approval.submitter_signature_url}
              startIcon={<RemixIcon icon="solar:pen-new-square-bold" />}
              onClick={() => approveMutation.mutate()}
            >
              เซ็นและอนุมัติตารางเรียน
            </Button>
          )}
        </Box>
      </Card>

      {scheduleQuery.data && (
        <ScheduleApprovalPdfDialog
          open={pdfOpen}
          onClose={() => setPdfOpen(false)}
          approval={approval}
          schedules={scheduleQuery.data.schedules}
          assignments={scheduleQuery.data.assignments}
          periods={scheduleQuery.data.periods}
          scheduleMode={scheduleQuery.data.scheduleMode}
          signature={pdfSignature}
          approverName={
            approval.status === 'approved'
              ? fullName(approval.approved_by)
              : isReadOnly
                ? 'รอผู้อำนวยการลงนาม'
                : directorName
          }
        />
      )}
    </Container>
  );
}
