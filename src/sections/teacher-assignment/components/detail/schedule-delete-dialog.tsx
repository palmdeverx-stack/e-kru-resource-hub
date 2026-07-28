'use client';

import type { ScheduleSlot } from '../../teacher-assignment-actions';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';

import { DAY_LABELS } from './teacher-assignment-detail-types';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  schedule: ScheduleSlot | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ScheduleDeleteDialog({ open, schedule, isDeleting, onClose, onConfirm }: Props) {
  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={isDeleting ? undefined : onClose}>
      <DialogTitle>ยืนยันการลบคาบสอน</DialogTitle>
      <DialogContent>
        <DialogContentText>
          ต้องการลบคาบสอนวัน{schedule ? DAY_LABELS[schedule.day_of_week] : ''}{' '}
          {schedule?.start_time.slice(0, 5)}–{schedule?.end_time.slice(0, 5)} ใช่หรือไม่
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" variant="outlined" disabled={isDeleting} onClick={onClose}>
          ยกเลิก
        </Button>
        <Button color="error" variant="contained" loading={isDeleting} onClick={onConfirm}>
          ลบคาบสอน
        </Button>
      </DialogActions>
    </Dialog>
  );
}
