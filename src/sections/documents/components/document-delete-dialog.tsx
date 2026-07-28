'use client';

import type { UserDocument } from '../document-actions';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { toast } from 'src/components/snackbar';

import { deleteMyDocument } from '../document-actions';

// ----------------------------------------------------------------------

type Props = {
  document: UserDocument | null;
  onClose: () => void;
};

export function DocumentDeleteDialog({ document, onClose }: Props) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: deleteMyDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-documents'] });
      toast.success('ลบเอกสารแล้ว');
      onClose();
    },
  });

  const handleClose = () => {
    if (mutation.isPending) return;
    mutation.reset();
    onClose();
  };

  return (
    <Dialog open={!!document} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>ยืนยันการลบเอกสาร</DialogTitle>
      <DialogContent>
        {mutation.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {mutation.error.message}
          </Alert>
        )}
        <Typography variant="body2">
          ต้องการลบเอกสาร <strong>{document?.title}</strong> ใช่หรือไม่?
        </Typography>
        <Alert severity="warning" sx={{ mt: 2 }}>
          การดำเนินการนี้ย้อนกลับไม่ได้
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={handleClose} disabled={mutation.isPending}>
          ยกเลิก
        </Button>
        <Button
          color="error"
          variant="contained"
          loading={mutation.isPending}
          onClick={() => document && mutation.mutate(document.id)}
        >
          ลบเอกสาร
        </Button>
      </DialogActions>
    </Dialog>
  );
}
