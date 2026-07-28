'use client';

import type { AssignmentCategory } from 'src/sections/assignment/assignment-actions';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { useRouter } from 'src/routes/hooks';

import { RemixIcon } from 'src/components/remix-icon';

import {
  createAssignment,
  ASSIGNMENT_CATEGORY_META,
} from 'src/sections/assignment/assignment-actions';

// ----------------------------------------------------------------------

type QuickScoreCategory = Exclude<AssignmentCategory, 'assignment'>;

type Props = {
  open: boolean;
  category: QuickScoreCategory;
  teacherAssignmentId: string;
  gradebookPath: (assignmentId: string) => string;
  onClose: () => void;
};

export function QuickScoreDialog({
  open,
  category,
  teacherAssignmentId,
  gradebookPath,
  onClose,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const meta = ASSIGNMENT_CATEGORY_META[category];
  const [title, setTitle] = useState(meta.defaultTitle);
  const [fullScore, setFullScore] = useState('100');
  const numericFullScore = Number(fullScore);
  const titleError = !title.trim();
  const scoreError = !Number.isFinite(numericFullScore) || numericFullScore <= 0;

  const createMutation = useMutation({
    mutationFn: () =>
      createAssignment(teacherAssignmentId, {
        title: title.trim(),
        fullScore: numericFullScore,
        category,
      }),
    onSuccess: async (assignment) => {
      await queryClient.invalidateQueries({ queryKey: ['assignments', teacherAssignmentId] });
      onClose();
      router.push(gradebookPath(assignment.id));
    },
  });

  return (
    <Dialog
      open={open}
      onClose={createMutation.isPending ? undefined : onClose}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle sx={{ pb: 1 }}>{meta.createHeading}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2.5, color: 'text.secondary' }}>
          กำหนดรายการและคะแนนเต็ม จากนั้นระบบจะเปิดรายชื่อนักเรียนให้กรอกคะแนนทันที
        </Typography>

        {createMutation.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {createMutation.error.message}
          </Alert>
        )}

        <Box sx={{ gap: 2, display: 'grid' }}>
          <TextField
            required
            autoFocus={!meta.singleton}
            label="ชื่อรายการ"
            value={title}
            disabled={meta.singleton}
            error={titleError}
            helperText={
              meta.singleton
                ? 'ระบบกำหนดชื่อรายการให้อัตโนมัติ'
                : 'เช่น แบบทดสอบบทที่ 1 หรือคะแนนจิตพิสัย'
            }
            onChange={(event) => setTitle(event.target.value)}
          />
          <TextField
            required
            autoFocus={meta.singleton}
            type="number"
            label="คะแนนเต็ม"
            value={fullScore}
            error={scoreError}
            helperText={scoreError ? 'คะแนนเต็มต้องมากกว่า 0' : 'รองรับคะแนนทศนิยม'}
            onChange={(event) => setFullScore(event.target.value)}
            slotProps={{ htmlInput: { min: 0.5, step: 0.5 } }}
          />
        </Box>

        <Alert severity="info" icon={<RemixIcon icon="solar:info-circle-bold" />} sx={{ mt: 2.5 }}>
          รายการนี้ใช้สำหรับบันทึกคะแนน ไม่สร้างงานที่นักเรียนต้องส่ง
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" disabled={createMutation.isPending} onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          loading={createMutation.isPending}
          disabled={titleError || scoreError}
          startIcon={<RemixIcon icon="solar:pen-bold" />}
          onClick={() => createMutation.mutate()}
        >
          สร้างและกรอกคะแนน
        </Button>
      </DialogActions>
    </Dialog>
  );
}
