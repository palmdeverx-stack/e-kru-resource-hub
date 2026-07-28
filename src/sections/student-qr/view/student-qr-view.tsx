'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { RemixIcon } from 'src/components/remix-icon';

import { getMyStudentQr } from '../student-qr-actions';

// ----------------------------------------------------------------------

export function StudentQrView() {
  const [qrImage, setQrImage] = useState('');
  const qrQuery = useQuery({
    queryKey: ['my-student-qr'],
    queryFn: getMyStudentQr,
  });

  useEffect(() => {
    const payload = qrQuery.data?.payload;
    if (!payload) return undefined;
    let active = true;

    const generateQrImage = async () => {
      const { default: QRCode } = await import('qrcode');
      const url = await QRCode.toDataURL(payload, {
        width: 620,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#111827', light: '#FFFFFF' },
      });
      if (active) setQrImage(url);
    };

    void generateQrImage().catch(() => {
      if (active) setQrImage('');
    });

    return () => {
      active = false;
    };
  }, [qrQuery.data?.payload]);

  if (qrQuery.isLoading) {
    return (
      <Box sx={{ py: 12, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (qrQuery.isError || !qrQuery.data) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => qrQuery.refetch()}>
              ลองอีกครั้ง
            </Button>
          }
        >
          {qrQuery.error?.message ?? 'ไม่สามารถโหลด QR ได้'}
        </Alert>
      </Container>
    );
  }

  const { student } = qrQuery.data;
  const name = `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || student.username;

  return (
    <Container maxWidth="sm" sx={{ pt: { xs: 2, md: 4 }, pb: { xs: 5, md: 7 } }}>
      <Box sx={{ mb: 3, textAlign: 'center' }}>
        <Typography component="h1" variant="h3">
          QR เช็คชื่อของฉัน
        </Typography>
        <Typography sx={{ mt: 1, color: 'text.secondary' }}>
          ใช้ใบเดียวสำหรับเข้าแถวเช้า–เย็นและเข้าเรียนทุกคาบ
        </Typography>
      </Box>

      <Card
        variant="outlined"
        sx={{
          p: { xs: 2.5, sm: 4 },
          textAlign: 'center',
          borderRadius: 3,
          boxShadow: '0 16px 48px rgba(0,0,0,0.08)',
        }}
      >
        <Avatar
          src={student.avatar_url ?? undefined}
          sx={{ mx: 'auto', width: 64, height: 64, fontSize: 24 }}
        >
          {name.charAt(0)}
        </Avatar>
        <Typography variant="h5" sx={{ mt: 1.5 }}>
          {name}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {student.student_code ?? `@${student.username}`}
        </Typography>

        <Box
          sx={{
            my: 3,
            mx: 'auto',
            p: 1,
            width: 380,
            maxWidth: 1,
            borderRadius: 2,
            bgcolor: 'common.white',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {qrImage ? (
            <Box component="img" src={qrImage} alt={`QR เช็คชื่อของ ${name}`} sx={{ width: 1 }} />
          ) : (
            <Box sx={{ height: 340, display: 'grid', placeItems: 'center' }}>
              <CircularProgress />
            </Box>
          )}
        </Box>

        <Alert
          severity="info"
          icon={<RemixIcon icon="solar:user-id-bold" />}
          sx={{ textAlign: 'left' }}
        >
          แสดง QR นี้ให้ครูสแกน ไม่ต้องส่งภาพให้ผู้อื่น หาก QR สูญหายให้แจ้งครูประจำชั้นเพื่อออกใหม่
        </Alert>
      </Card>
    </Container>
  );
}
