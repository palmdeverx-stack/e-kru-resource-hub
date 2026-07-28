'use client';

import type { HomeroomEnrollment } from '../teacher-students-actions';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { RemixIcon } from 'src/components/remix-icon';

import { issueStudentQr } from '../student-qr-actions';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  student: HomeroomEnrollment['student'] | null;
  classroomName?: string;
  academicYear?: string;
  onClose: () => void;
};

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

export function StudentQrDialog({ open, student, classroomName, academicYear, onClose }: Props) {
  const [qrImage, setQrImage] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [downloadPending, setDownloadPending] = useState(false);
  const issueMutation = useMutation({
    mutationFn: (regenerate: boolean) => issueStudentQr(student!.id, regenerate),
  });

  useEffect(() => {
    if (!open || !student) return;
    setQrImage('');
    issueMutation.reset();
    issueMutation.mutate(false);
    // The dialog is intentionally reloaded only when its student/open state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student?.id]);

  useEffect(() => {
    const payload = issueMutation.data?.payload;
    if (!payload) return undefined;
    let active = true;

    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(payload, {
          width: 420,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#111827', light: '#FFFFFF' },
        })
      )
      .then((url) => {
        if (active) setQrImage(url);
      })
      .catch(() => {
        if (active) setQrImage('');
      });
    return () => {
      active = false;
    };
  }, [issueMutation.data?.payload]);

  if (!student) return null;

  const name = `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || student.username;

  const downloadQr = async () => {
    if (!qrImage) return;
    setDownloadError('');
    setDownloadPending(true);

    try {
      if (document.fonts) {
        await document.fonts.ready;
        await Promise.all([
          document.fonts.load('700 38px "LINE Seed Sans TH"'),
          document.fonts.load('400 27px "LINE Seed Sans TH"'),
        ]);
      }
      const qr = await loadImage(qrImage);
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 880;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('ไม่สามารถสร้างไฟล์ภาพได้');

      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.textAlign = 'center';
      context.drawImage(qr, 120, 28, 560, 560);

      context.fillStyle = '#111827';
      context.font = '700 38px "LINE Seed Sans TH", sans-serif';
      context.fillText(name, 400, 655, 700);

      context.fillStyle = '#4B5563';
      context.font = '400 27px "LINE Seed Sans TH", sans-serif';
      context.fillText(`รหัสนักเรียน ${student.student_code ?? student.username}`, 400, 715, 700);
      context.fillText(`ชั้นเรียน ${classroomName ?? '-'}`, 400, 765, 700);
      context.fillText(`ปีการศึกษา ${academicYear ?? '-'}`, 400, 815, 700);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error('ไม่สามารถสร้างไฟล์ภาพได้'))),
          'image/png'
        );
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `student-qr-${student.student_code ?? student.username}.png`.replace(
        /[^\wก-๙.-]+/g,
        '-'
      );
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError('ไม่สามารถสร้างไฟล์ QR ได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setDownloadPending(false);
    }
  };

  const regenerate = () => {
    if (!window.confirm('QR เดิมจะใช้งานไม่ได้ทันที ยืนยันออก QR ใหม่หรือไม่?')) return;
    setQrImage('');
    issueMutation.mutate(true);
  };

  return (
    <Dialog
      open={open}
      onClose={issueMutation.isPending ? undefined : onClose}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>QR ประจำตัวนักเรียน</DialogTitle>
      <DialogContent>
        {issueMutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {issueMutation.error.message}
          </Alert>
        )}
        {downloadError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {downloadError}
          </Alert>
        )}

        <Box sx={{ py: 1, textAlign: 'center' }}>
          <Typography variant="h6">{name}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {student.student_code ?? `@${student.username}`}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {classroomName ?? '-'} · ปีการศึกษา {academicYear ?? '-'}
          </Typography>

          <Box
            sx={{
              my: 2.5,
              mx: 'auto',
              width: 300,
              height: 300,
              maxWidth: 1,
              display: 'grid',
              borderRadius: 2,
              bgcolor: 'common.white',
              placeItems: 'center',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            {issueMutation.isPending && <CircularProgress />}
            {!issueMutation.isPending && qrImage && (
              <Box component="img" src={qrImage} alt={`QR ของ ${name}`} sx={{ width: 1 }} />
            )}
          </Box>

          <Alert severity="info" sx={{ textAlign: 'left' }}>
            ใช้ QR ใบนี้ได้ทั้งเข้าแถวเช้า–เย็นและเข้าเรียนทุกคาบ ครูผู้สแกนเป็นผู้เลือกบริบทก่อน
          </Alert>
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button
          color="warning"
          disabled={issueMutation.isPending}
          onClick={regenerate}
          startIcon={<RemixIcon icon="solar:restart-bold" />}
        >
          ออก QR ใหม่
        </Button>
        <Box sx={{ gap: 1, display: 'flex' }}>
          <Button color="inherit" onClick={onClose}>
            ปิด
          </Button>
          <Button
            variant="contained"
            disabled={!qrImage}
            loading={downloadPending}
            onClick={() => void downloadQr()}
            startIcon={<RemixIcon icon="solar:download-bold" />}
          >
            ดาวน์โหลด
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
