'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Step from '@mui/material/Step';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stepper from '@mui/material/Stepper';
import Divider from '@mui/material/Divider';
import StepLabel from '@mui/material/StepLabel';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { RemixIcon } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { ScheduleGrid } from '../components/schedule-grid';
import { SignaturePad } from '../../schedule-approvals/components/signature-pad';
import {
  getScheduleApproval,
  getClassroomSchedule,
  submitScheduleForApproval,
} from '../schedule-builder-actions';

// ----------------------------------------------------------------------

type Props = {
  classroomId: string;
  semesterId: string;
};

export function ScheduleSubmissionSignView({ classroomId, semesterId }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const [signature, setSignature] = useState('');
  const backPath =
    user?.role === 'teacher' ? paths.teacher.scheduleBuilder : paths.admin.scheduleBuilder;

  const scheduleQuery = useQuery({
    queryKey: ['classroom-schedule', classroomId, semesterId],
    queryFn: () => getClassroomSchedule(classroomId, semesterId),
  });
  const approvalQuery = useQuery({
    queryKey: ['classroom-schedule-approval', classroomId, semesterId],
    queryFn: () => getScheduleApproval(classroomId, semesterId),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitScheduleForApproval(classroomId, semesterId, signature),
    onSuccess: async () => {
      setSignature('');
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['classroom-schedule-approval', classroomId, semesterId],
        }),
        queryClient.invalidateQueries({ queryKey: ['schedule-approvals'] }),
      ]);
    },
  });

  const preparerName =
    `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || user?.username || 'ผู้จัดทำ';
  const positionTitle = user?.position_title || 'ผู้จัดทำตารางเรียน';
  const isSubmitted =
    approvalQuery.data?.status === 'submitted' && !!approvalQuery.data.submitter_signature_url;
  const isApproved = approvalQuery.data?.status === 'approved';
  const isLocked = isSubmitted || isApproved;

  if (scheduleQuery.isLoading || approvalQuery.isLoading) {
    return (
      <Box sx={{ py: 12, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (scheduleQuery.isError || approvalQuery.isError || !scheduleQuery.data) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert
          severity="error"
          action={
            <Button component={RouterLink} href={backPath} color="inherit">
              กลับหน้าจัดตาราง
            </Button>
          }
        >
          ไม่สามารถโหลดข้อมูลตารางเรียนได้
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ pb: 6 }}>
      <Button
        component={RouterLink}
        href={backPath}
        color="inherit"
        startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
        sx={{ mb: 2 }}
      >
        กลับหน้าจัดตาราง
      </Button>

      <Box sx={{ mb: 3 }}>
        <Typography component="h1" variant="h3">
          ลงนามส่งตารางเรียน
        </Typography>
        <Typography sx={{ mt: 0.75, color: 'text.secondary' }}>
          ชั้น {scheduleQuery.data.classroom.grade_level ?? '-'}{' '}
          {scheduleQuery.data.classroom.name}
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Stepper activeStep={isApproved ? 2 : isSubmitted ? 1 : 0} alternativeLabel>
          <Step completed={isLocked}>
            <StepLabel>ผู้จัดทำตรวจสอบและลงนาม</StepLabel>
          </Step>
          <Step completed={isApproved}>
            <StepLabel>ผู้อำนวยการตรวจสอบและลงนาม</StepLabel>
          </Step>
        </Stepper>
      </Card>

      {submitMutation.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {submitMutation.error.message}
        </Alert>
      )}
      {isSubmitted && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          action={
            <Button component={RouterLink} href={backPath} color="inherit">
              กลับหน้าจัดตาราง
            </Button>
          }
        >
          ลงลายเซ็นและส่งให้ผู้อำนวยการเรียบร้อยแล้ว ขณะนี้อยู่ระหว่างรออนุมัติ
        </Alert>
      )}
      {isApproved && (
        <Alert severity="success" sx={{ mb: 3 }}>
          ตารางเรียนนี้ได้รับการลงนามและอนุมัติครบทั้งสองขั้นตอนแล้ว
        </Alert>
      )}

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
            <Typography variant="h6">ตรวจสอบตารางเรียนก่อนลงนาม</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              เมื่อลงนามแล้ว ระบบจะส่งรายการนี้ไปยังหน้ารออนุมัติของผู้อำนวยการ
            </Typography>
          </Box>
          <Chip
            size="small"
            variant="outlined"
            label={`${scheduleQuery.data.schedules.length} คาบ`}
          />
        </Box>
        <ScheduleGrid
          schedules={scheduleQuery.data.schedules}
          assignments={scheduleQuery.data.assignments}
          periods={scheduleQuery.data.periods}
          scheduleMode={scheduleQuery.data.scheduleMode}
        />
      </Card>

      {!isLocked && (
        <Card variant="outlined" sx={{ overflow: 'hidden' }}>
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6">ลายเซ็นผู้จัดทำตารางเรียน</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, mb: 2.5, color: 'text.secondary' }}>
              ข้าพเจ้าตรวจสอบแล้วว่าข้อมูลรายวิชา ครูผู้สอน วันและเวลาถูกต้องครบถ้วน
            </Typography>
            <SignaturePad
              value={signature}
              onChange={setSignature}
              disabled={submitMutation.isPending}
            />
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
              <Typography variant="subtitle2">{preparerName}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {positionTitle}
              </Typography>
            </Box>
            <Button
              size="large"
              color="warning"
              variant="contained"
              loading={submitMutation.isPending}
              disabled={!signature || !scheduleQuery.data.schedules.length}
              startIcon={<RemixIcon icon="solar:pen-new-square-bold" />}
              onClick={() => submitMutation.mutate()}
            >
              ลงนามและส่งให้ผู้อำนวยการ
            </Button>
          </Box>
        </Card>
      )}
    </Container>
  );
}
