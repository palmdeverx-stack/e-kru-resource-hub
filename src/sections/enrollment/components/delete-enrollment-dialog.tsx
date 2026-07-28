'use client';

import type { Enrollment } from '../enrollment-actions';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

// ----------------------------------------------------------------------

type Props = {
  enrollment: Enrollment | null;
  pending?: boolean;
  error?: Error | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
};

export function DeleteEnrollmentDialog({
  enrollment,
  pending = false,
  error,
  onClose,
  onConfirm,
}: Props) {
  const studentName = enrollment
    ? `${enrollment.student.first_name ?? ''} ${enrollment.student.last_name ?? ''}`.trim() ||
      enrollment.student.username
    : '';

  return (
    <Dialog open={!!enrollment} onClose={() => !pending && onClose()} fullWidth maxWidth="xs">
      <DialogTitle>ลบการลงทะเบียน</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error.message}
          </Alert>
        )}
        <Typography>
          ต้องการนำ <strong>{studentName}</strong> ออกจากห้อง {enrollment?.classroom.name}{' '}
          ใช่หรือไม่
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" disabled={pending} onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          color="error"
          variant="contained"
          loading={pending}
          onClick={() => enrollment && onConfirm(enrollment.id)}
        >
          ลบการลงทะเบียน
        </Button>
      </DialogActions>
    </Dialog>
  );
}
