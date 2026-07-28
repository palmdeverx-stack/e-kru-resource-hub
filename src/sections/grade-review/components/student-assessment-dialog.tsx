'use client';

import type { ScoreReport } from 'src/sections/teacher-assignment/score-report-actions';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';

import { updateStudentAssessment } from '../grade-review-actions';

// ----------------------------------------------------------------------

type Student = ScoreReport['students'][number];

export function StudentAssessmentDialog({
  open,
  onClose,
  teacherAssignmentId,
  student,
  canEditSpecial,
  canManageAssessment,
}: {
  open: boolean;
  onClose: () => void;
  teacherAssignmentId: string;
  student: Student;
  canEditSpecial: boolean;
  canManageAssessment: boolean;
}) {
  const queryClient = useQueryClient();
  const [specialResult, setSpecialResult] = useState(student.specialResult ?? '');
  const [desirableLevel, setDesirableLevel] = useState(
    student.desirableAttributesLevel?.toString() ?? ''
  );
  const [readingLevel, setReadingLevel] = useState(
    student.readingThinkingWritingLevel?.toString() ?? ''
  );
  const [activityResult, setActivityResult] = useState(student.activityResult ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      updateStudentAssessment(teacherAssignmentId, {
        studentId: student.id,
        specialResult: specialResult ? (specialResult as 'ร' | 'มส' | 'มผ') : null,
        desirableAttributesLevel: desirableLevel === '' ? null : Number(desirableLevel),
        readingThinkingWritingLevel: readingLevel === '' ? null : Number(readingLevel),
        activityResult: activityResult
          ? (activityResult as 'pass' | 'fail' | 'pending')
          : null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['score-report', teacherAssignmentId] });
      onClose();
    },
  });

  const name =
    `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() || student.username;

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>ผลการเรียนและผลประเมินรายบุคคล</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {student.studentCode || student.studentNumber || '-'} · {name}
        </DialogContentText>
        {mutation.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {mutation.error.message}
          </Alert>
        )}
        <TextField
          select
          fullWidth
          label="ผลการเรียนกรณีพิเศษ"
          value={specialResult}
          disabled={!canEditSpecial}
          onChange={(event) => setSpecialResult(event.target.value)}
          helperText="เลือกเฉพาะกรณี ร, มส หรือ มผ หากปกติให้เลือก “คำนวณจากคะแนน”"
          sx={{ mb: 2 }}
        >
          <MenuItem value="">คำนวณจากคะแนน</MenuItem>
          <MenuItem value="ร">ร — รอการตัดสิน</MenuItem>
          <MenuItem value="มส">มส — ไม่มีสิทธิ์สอบ</MenuItem>
          <MenuItem value="มผ">มผ — ไม่ผ่านกิจกรรม</MenuItem>
        </TextField>
        <TextField
          select
          fullWidth
          label="คุณลักษณะอันพึงประสงค์"
          value={desirableLevel}
          disabled={!canManageAssessment}
          onChange={(event) => setDesirableLevel(event.target.value)}
          sx={{ mb: 2 }}
        >
          <MenuItem value="">ยังไม่ระบุ</MenuItem>
          <MenuItem value="3">3 — ดีเยี่ยม</MenuItem>
          <MenuItem value="2">2 — ดี</MenuItem>
          <MenuItem value="1">1 — ผ่าน</MenuItem>
          <MenuItem value="0">0 — ไม่ผ่าน</MenuItem>
        </TextField>
        <TextField
          select
          fullWidth
          label="การอ่าน คิดวิเคราะห์และเขียน"
          value={readingLevel}
          disabled={!canManageAssessment}
          onChange={(event) => setReadingLevel(event.target.value)}
          sx={{ mb: 2 }}
        >
          <MenuItem value="">ยังไม่ระบุ</MenuItem>
          <MenuItem value="3">3 — ดีเยี่ยม</MenuItem>
          <MenuItem value="2">2 — ดี</MenuItem>
          <MenuItem value="1">1 — ผ่าน</MenuItem>
          <MenuItem value="0">0 — ไม่ผ่าน</MenuItem>
        </TextField>
        <TextField
          select
          fullWidth
          label="กิจกรรมพัฒนาผู้เรียน"
          value={activityResult}
          disabled={!canManageAssessment}
          onChange={(event) => setActivityResult(event.target.value)}
        >
          <MenuItem value="">ยังไม่ระบุ</MenuItem>
          <MenuItem value="pass">ผ่าน</MenuItem>
          <MenuItem value="fail">ไม่ผ่าน</MenuItem>
          <MenuItem value="pending">รอประเมิน</MenuItem>
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={mutation.isPending}>
          ปิด
        </Button>
        {(canEditSpecial || canManageAssessment) && (
          <Button variant="contained" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            บันทึก
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
