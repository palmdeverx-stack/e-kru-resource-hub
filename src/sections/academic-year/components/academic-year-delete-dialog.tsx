'use client';

import type { AcademicYear } from '../academic-year-actions';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { deleteAcademicYear } from '../academic-year-actions';

// ----------------------------------------------------------------------

type Props = {
  academicYear: AcademicYear | null;
  onClose: () => void;
  onDeleted: () => void;
};

export function AcademicYearDeleteDialog({ academicYear, onClose, onDeleted }: Props) {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: deleteAcademicYear,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      onDeleted();
      onClose();
    },
  });

  const handleClose = () => {
    if (deleteMutation.isPending) return;
    deleteMutation.reset();
    onClose();
  };

  return (
    <Dialog open={!!academicYear} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>ยืนยันการลบปีการศึกษา</DialogTitle>
      <DialogContent>
        {deleteMutation.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {deleteMutation.error.message}
          </Alert>
        )}
        <Typography variant="body2">
          ต้องการลบปีการศึกษา <strong>{academicYear?.year}</strong> ใช่หรือไม่?
        </Typography>
        <Alert severity="warning" sx={{ mt: 2 }}>
          ภาคเรียน ห้องเรียน รายชื่อนักเรียน งาน และคะแนนที่เชื่อมโยงอาจถูกลบตามไปด้วย
          การดำเนินการนี้ย้อนกลับไม่ได้
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={handleClose} disabled={deleteMutation.isPending}>
          ยกเลิก
        </Button>
        <Button
          color="error"
          variant="contained"
          loading={deleteMutation.isPending}
          onClick={() => academicYear && deleteMutation.mutate(academicYear.id)}
        >
          ลบปีการศึกษา
        </Button>
      </DialogActions>
    </Dialog>
  );
}
