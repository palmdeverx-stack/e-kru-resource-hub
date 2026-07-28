'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { RemixIcon } from 'src/components/remix-icon';

import { getScoreReport } from 'src/sections/teacher-assignment/score-report-actions';

import { StudentAssessmentDialog } from './student-assessment-dialog';
import {
  updateGradeReview,
  getGradeReviewSubmission,
} from '../grade-review-actions';

// ----------------------------------------------------------------------

const STATUS = {
  draft: { label: 'ยังไม่ส่ง', color: 'default' },
  submitted: { label: 'รอฝ่ายวิชาการตรวจ', color: 'warning' },
  revision: { label: 'ฝ่ายวิชาการส่งกลับแก้ไข', color: 'error' },
  reviewed: { label: 'ตรวจสอบแล้ว', color: 'info' },
  approved: { label: 'อนุมัติแล้ว', color: 'success' },
  locked: { label: 'ปิดผลการเรียนแล้ว', color: 'success' },
} as const;

export function GradeSubmissionCard({ teacherAssignmentId }: { teacherAssignmentId: string }) {
  const queryClient = useQueryClient();
  const [assessmentStudentId, setAssessmentStudentId] = useState('');
  const { data: submission, isLoading } = useQuery({
    queryKey: ['grade-review', teacherAssignmentId],
    queryFn: () => getGradeReviewSubmission(teacherAssignmentId),
  });
  const mutation = useMutation({
    mutationFn: () => updateGradeReview(teacherAssignmentId, 'submit'),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['grade-review', teacherAssignmentId] }),
        queryClient.invalidateQueries({ queryKey: ['grade-reviews'] }),
      ]);
    },
  });
  const status = submission?.status ?? 'draft';
  const canSubmit = status === 'draft' || status === 'revision';
  const reportQuery = useQuery({
    queryKey: ['score-report', teacherAssignmentId],
    queryFn: () => getScoreReport(teacherAssignmentId),
    enabled: canSubmit,
  });
  const assessmentStudent = reportQuery.data?.students.find(
    (student) => student.id === assessmentStudentId
  );

  return (
    <Card variant="outlined" sx={{ p: 2.5, mb: 3 }}>
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
          <Box sx={{ gap: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="h6">ส่งผลการเรียนปลายภาค</Typography>
            {!isLoading && (
              <Chip
                size="small"
                variant="soft"
                color={STATUS[status].color}
                label={STATUS[status].label}
              />
            )}
          </Box>
          <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
            ระบบจะตรวจว่าบันทึกคะแนนนักเรียนครบทุกคนก่อนส่งให้ฝ่ายวิชาการ
          </Typography>
        </Box>
        {canSubmit && (
          <Box sx={{ gap: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              select
              size="small"
              label="กำหนด ร/มส/มผ"
              value=""
              sx={{ minWidth: 210 }}
              onChange={(event) => setAssessmentStudentId(event.target.value)}
            >
              {reportQuery.data?.students.map((student) => (
                <MenuItem key={student.id} value={student.id}>
                  {student.studentNumber || student.studentCode || '-'} ·{' '}
                  {`${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() ||
                    student.username}
                  {student.specialResult ? ` (${student.specialResult})` : ''}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              loading={mutation.isPending}
              startIcon={<RemixIcon icon="solar:plain-bold" />}
              onClick={() => mutation.mutate()}
            >
              {status === 'revision' ? 'ส่งผลการเรียนอีกครั้ง' : 'ส่งฝ่ายวิชาการ'}
            </Button>
          </Box>
        )}
      </Box>
      {submission?.note && (
        <Alert severity={status === 'revision' ? 'warning' : 'info'} sx={{ mt: 2 }}>
          หมายเหตุจากฝ่ายวิชาการ: {submission.note}
        </Alert>
      )}
      {mutation.error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {mutation.error.message}
        </Alert>
      )}
      {assessmentStudent && (
        <StudentAssessmentDialog
          open
          teacherAssignmentId={teacherAssignmentId}
          student={assessmentStudent}
          canEditSpecial
          canManageAssessment={false}
          onClose={() => setAssessmentStudentId('')}
        />
      )}
    </Card>
  );
}
