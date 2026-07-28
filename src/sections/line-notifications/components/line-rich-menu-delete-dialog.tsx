import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  loading: boolean;
  errorMessage?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function LineRichMenuDeleteDialog({
  open,
  loading,
  errorMessage,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>ยกเลิก Rich Menu?</DialogTitle>
      <DialogContent>
        <Typography>
          Rich Menu จะหายจากหน้าสนทนาของผู้ปกครอง และรายการที่สร้างผ่านระบบนี้จะถูกลบจาก LINE
        </Typography>
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
        <Button color="error" variant="contained" loading={loading} onClick={onConfirm}>
          ยืนยันยกเลิก
        </Button>
      </DialogActions>
    </Dialog>
  );
}
