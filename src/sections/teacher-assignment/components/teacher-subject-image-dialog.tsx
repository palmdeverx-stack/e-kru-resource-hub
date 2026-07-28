'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { Upload } from 'src/components/upload';
import { RemixIcon } from 'src/components/remix-icon';

import { uploadSubjectImage, removeSubjectImage } from 'src/sections/subject/subject-actions';

// ----------------------------------------------------------------------

const IMAGE_ACCEPT = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

type Props = {
  open: boolean;
  subjectId: string;
  subjectName: string;
  imageUrl: string | null;
  onClose: () => void;
};

export function TeacherSubjectImageDialog({
  open,
  subjectId,
  subjectName,
  imageUrl,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['roster'] }),
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['subjects'] }),
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] }),
    ]);
    onClose();
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadSubjectImage(subjectId, file),
    onSuccess: refresh,
  });
  const removeMutation = useMutation({
    mutationFn: () => removeSubjectImage(subjectId),
    onSuccess: refresh,
  });

  const pending = uploadMutation.isPending || removeMutation.isPending;
  const error = uploadMutation.error ?? removeMutation.error;

  const handleClose = () => {
    if (pending) return;
    uploadMutation.reset();
    removeMutation.reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Typography component="h2" variant="h6">
          รูปภาพรายวิชา
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {subjectName}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2.5 }}>
            {error.message}
          </Alert>
        )}
        <Upload
          value={imageUrl ?? undefined}
          accept={IMAGE_ACCEPT}
          maxSize={MAX_IMAGE_SIZE}
          disabled={pending}
          loading={uploadMutation.isPending}
          onDrop={(files) => {
            const file = files[0];
            if (file) uploadMutation.mutate(file);
          }}
          helperText="PNG, JPEG หรือ WEBP ขนาดไม่เกิน 5MB แนะนำอัตราส่วน 16:9"
          sx={{ height: { xs: 210, sm: 280 } }}
        />
        <Alert severity="info" sx={{ mt: 2.5 }}>
          รูปนี้จะแสดงให้นักเรียนเห็นในหน้าวิชาเรียน
        </Alert>
      </DialogContent>

      <DialogActions>
        {imageUrl && (
          <Button
            color="error"
            loading={removeMutation.isPending}
            disabled={uploadMutation.isPending}
            startIcon={<RemixIcon icon="solar:trash-bin-trash-bold" />}
            onClick={() => removeMutation.mutate()}
            sx={{ mr: 'auto' }}
          >
            ลบรูป
          </Button>
        )}
        <Button color="inherit" onClick={handleClose} disabled={pending}>
          ปิด
        </Button>
      </DialogActions>
    </Dialog>
  );
}
