import type { StudentGuardian } from '../student-guardian-actions';

import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

// ----------------------------------------------------------------------

type Props = {
  guardian: StudentGuardian | null;
  errorMessage?: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function GuardianDeleteDialog({
  guardian,
  errorMessage,
  loading,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Dialog open={Boolean(guardian)} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>ลบข้อมูลผู้ปกครอง?</DialogTitle>
      <DialogContent>
        <Typography>ต้องการลบข้อมูลของ {guardian?.full_name} ใช่หรือไม่</Typography>
        {errorMessage && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          color="error"
          variant="contained"
          loading={loading}
          disabled={!guardian}
          onClick={onConfirm}
        >
          ลบข้อมูล
        </Button>
      </DialogActions>
    </Dialog>
  );
}
