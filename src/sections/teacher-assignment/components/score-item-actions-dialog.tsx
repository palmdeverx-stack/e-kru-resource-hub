'use client';

import type { Assignment } from 'src/sections/assignment/assignment-actions';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import { Box, Stack } from '@mui/material';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { RemixIcon } from 'src/components/remix-icon';

import { updateAssignment, deleteAssignment } from 'src/sections/assignment/assignment-actions';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  mode: 'edit' | 'delete';
  assignment: Assignment;
  teacherAssignmentId: string;
  onClose: () => void;
};

export function ScoreItemActionsDialog({
  open,
  mode,
  assignment,
  teacherAssignmentId,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(assignment.title);
  const [description, setDescription] = useState(assignment.description ?? '');
  const [fullScore, setFullScore] = useState(String(assignment.full_score));
  const numericFullScore = Number(fullScore);
  const isInvalid = !title.trim() || !Number.isFinite(numericFullScore) || numericFullScore <= 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === 'delete') {
        await deleteAssignment(assignment.id);
        return;
      }

      await updateAssignment(assignment.id, {
        title: title.trim(),
        description: description.trim(),
        fullScore: numericFullScore,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['assignments', teacherAssignmentId] });
      onClose();
    },
  });

  const isDelete = mode === 'delete';

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{isDelete ? 'ยืนยันการลบรายการคะแนน' : 'แก้ไขรายการคะแนน'}</DialogTitle>
      <DialogContent>
        <Stack sx={{ py: 1 }}>
          {mutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {mutation.error.message}
            </Alert>
          )}

          {isDelete ? (
            <>
              <Alert severity="warning" icon={<RemixIcon icon="solar:danger-triangle-bold" />}>
                การลบ “{assignment.title}” จะลบคะแนนและความคิดเห็นของนักเรียนในรายการนี้ทั้งหมด
              </Alert>
              <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                เมื่อลบแล้วจะไม่สามารถกู้คืนข้อมูลได้
              </Typography>
            </>
          ) : (
            <Box sx={{ pt: 0.5, gap: 2, display: 'grid' }}>
              <TextField
                required
                autoFocus
                label="ชื่อรายการ"
                value={title}
                error={!title.trim()}
                onChange={(event) => setTitle(event.target.value)}
              />
              <TextField
                label="รายละเอียด"
                value={description}
                multiline
                minRows={2}
                onChange={(event) => setDescription(event.target.value)}
              />
              <TextField
                required
                type="number"
                label="คะแนนเต็ม"
                value={fullScore}
                error={!Number.isFinite(numericFullScore) || numericFullScore <= 0}
                helperText="คะแนนเต็มต้องไม่น้อยกว่าคะแนนสูงสุดที่กรอกไว้"
                onChange={(event) => setFullScore(event.target.value)}
                slotProps={{ htmlInput: { min: 0.5, step: 0.5 } }}
              />
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" disabled={mutation.isPending} onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          color={isDelete ? 'error' : 'primary'}
          variant="contained"
          loading={mutation.isPending}
          disabled={!isDelete && isInvalid}
          startIcon={
            <RemixIcon icon={isDelete ? 'solar:trash-bin-trash-bold' : 'solar:check-circle-bold'} />
          }
          onClick={() => mutation.mutate()}
        >
          {isDelete ? 'ลบรายการ' : 'บันทึกการแก้ไข'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
