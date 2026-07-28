'use client';

import type { UserRow } from '../user-actions';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import {
  formatImageSize,
  resizeProfileImage,
  PROFILE_IMAGE_SOURCE_LIMIT_BYTES,
} from 'src/utils/resize-profile-image';

import { UploadAvatar } from 'src/components/upload';
import { RemixIcon } from 'src/components/remix-icon';

import { uploadStudentAvatar, deleteStudentAvatar } from '../user-actions';

// ----------------------------------------------------------------------

const AVATAR_ACCEPT = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

type Props = {
  student: UserRow | null;
  onClose: () => void;
};

export function StudentAvatarDialog({ student, onClose }: Props) {
  const queryClient = useQueryClient();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['users'] });
    setAvatarFile(null);
    setPrepareError(null);
    onClose();
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadStudentAvatar(student!.id, file),
    onSuccess: refresh,
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteStudentAvatar(student!.id),
    onSuccess: refresh,
  });

  const pending = isPreparing || uploadMutation.isPending || deleteMutation.isPending;
  const error = uploadMutation.error ?? deleteMutation.error;
  const displayName = student
    ? `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || student.username
    : '';

  const handleClose = () => {
    if (pending) return;
    uploadMutation.reset();
    deleteMutation.reset();
    setAvatarFile(null);
    setPrepareError(null);
    onClose();
  };

  const prepareAvatar = async (file: File) => {
    setPrepareError(null);
    setIsPreparing(true);
    uploadMutation.reset();
    try {
      setAvatarFile(await resizeProfileImage(file));
    } catch (prepareAvatarError) {
      setAvatarFile(null);
      setPrepareError(
        prepareAvatarError instanceof Error
          ? prepareAvatarError.message
          : 'ไม่สามารถเตรียมรูปภาพได้'
      );
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <Dialog open={!!student} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>
        <Typography component="h2" variant="h6">
          รูปโปรไฟล์นักเรียน
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {displayName}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {(error || prepareError) && (
          <Alert severity="error" sx={{ mb: 2.5 }}>
            {error?.message ?? prepareError}
          </Alert>
        )}
        <Box sx={{ py: 1, display: 'flex', justifyContent: 'center' }}>
          <UploadAvatar
            value={avatarFile ?? student?.avatar_url ?? undefined}
            loading={isPreparing || uploadMutation.isPending}
            disabled={pending}
            accept={AVATAR_ACCEPT}
            maxSize={PROFILE_IMAGE_SOURCE_LIMIT_BYTES}
            onDrop={(files) => {
              const file = files[0];
              if (file) void prepareAvatar(file);
            }}
            helperText={
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {avatarFile ? 'ตรวจสอบรูปก่อนกดบันทึก' : 'คลิกหรือลากรูปมาวางเพื่อเปลี่ยนรูป'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {avatarFile
                    ? `ย่อแล้ว ${formatImageSize(avatarFile.size)} · WEBP`
                    : 'PNG, JPEG หรือ WEBP · ระบบย่อให้ไม่เกิน 1MB'}
                </Typography>
              </Box>
            }
          />
        </Box>
        <Alert severity="info" sx={{ mt: 2.5 }}>
          เฉพาะผู้ดูแลโรงเรียนเท่านั้นที่สามารถเปลี่ยนรูปโปรไฟล์นักเรียนได้
        </Alert>
      </DialogContent>

      <DialogActions>
        {student?.avatar_url && !avatarFile && (
          <Button
            color="error"
            loading={deleteMutation.isPending}
            disabled={uploadMutation.isPending}
            startIcon={<RemixIcon icon="solar:trash-bin-trash-bold" />}
            onClick={() => deleteMutation.mutate()}
            sx={{ mr: 'auto' }}
          >
            ลบรูป
          </Button>
        )}
        <Button color="inherit" variant="outlined" onClick={handleClose} disabled={pending}>
          {avatarFile ? 'ยกเลิก' : 'ปิด'}
        </Button>
        {avatarFile && (
          <Button
            variant="contained"
            loading={uploadMutation.isPending}
            disabled={isPreparing || deleteMutation.isPending}
            onClick={() => uploadMutation.mutate(avatarFile)}
          >
            บันทึกรูป
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
