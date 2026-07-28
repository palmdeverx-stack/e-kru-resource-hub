import type { GuardianInput } from '../student-guardian-actions';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  editing: boolean;
  value: GuardianInput;
  errorMessage?: string;
  loading: boolean;
  onChange: (value: GuardianInput) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function GuardianFormDialog({
  open,
  editing,
  value,
  errorMessage,
  loading,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? 'แก้ไขข้อมูลผู้ปกครอง' : 'เพิ่มข้อมูลผู้ปกครอง'}</DialogTitle>
      <DialogContent>
        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}
        <Box sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <TextField
            required
            label="ชื่อ-นามสกุล"
            value={value.fullName}
            onChange={(event) => onChange({ ...value, fullName: event.target.value })}
            sx={{ gridColumn: { sm: '1 / -1' } }}
          />
          <TextField
            required
            label="ความสัมพันธ์"
            placeholder="เช่น บิดา มารดา"
            value={value.relationship}
            onChange={(event) => onChange({ ...value, relationship: event.target.value })}
          />
          <TextField
            required
            label="เบอร์โทรศัพท์"
            value={value.phone}
            onChange={(event) => onChange({ ...value, phone: event.target.value })}
          />
          <TextField
            label="อีเมล"
            type="email"
            value={value.email}
            onChange={(event) => onChange({ ...value, email: event.target.value })}
          />
          <TextField
            label="อาชีพ"
            value={value.occupation}
            onChange={(event) => onChange({ ...value, occupation: event.target.value })}
          />
          <TextField
            label="ที่อยู่"
            multiline
            minRows={2}
            value={value.address}
            onChange={(event) => onChange({ ...value, address: event.target.value })}
            sx={{ gridColumn: { sm: '1 / -1' } }}
          />
          <TextField
            label="หมายเหตุ"
            multiline
            minRows={2}
            value={value.notes}
            onChange={(event) => onChange({ ...value, notes: event.target.value })}
            sx={{ gridColumn: { sm: '1 / -1' } }}
          />
        </Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={value.isPrimary}
              onChange={(event) => onChange({ ...value, isPrimary: event.target.checked })}
            />
          }
          label="กำหนดเป็นผู้ติดต่อหลัก"
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button variant="contained" loading={loading} onClick={onSubmit}>
          บันทึก
        </Button>
      </DialogActions>
    </Dialog>
  );
}
