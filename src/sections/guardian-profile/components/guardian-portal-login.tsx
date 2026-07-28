'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { RemixIcon } from 'src/components/remix-icon';

import { loginGuardianPortal } from '../guardian-profile-actions';

// ----------------------------------------------------------------------

type Props = {
  onAuthenticated: () => void;
};

export function GuardianPortalLogin({ onAuthenticated }: Props) {
  const [studentCode, setStudentCode] = useState('');

  const loginMutation = useMutation({
    mutationFn: () => loginGuardianPortal(studentCode),
    onSuccess: onAuthenticated,
  });

  const submit = () => {
    if (studentCode.trim()) loginMutation.mutate();
  };

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
      <Card
        sx={{
          overflow: 'hidden',
          borderRadius: 3,
          alignContent: 'center',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6">กรอกรหัสนักเรียน</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              ใช้รหัสนักเรียนที่โรงเรียนบันทึกและเชื่อมกับบัญชี LINE นี้
            </Typography>
          </Box>

          {loginMutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {loginMutation.error.message}
            </Alert>
          )}

          <TextField
            autoFocus
            fullWidth
            label="รหัสนักเรียน"
            placeholder="กรอกรหัสนักเรียน"
            value={studentCode}
            disabled={loginMutation.isPending}
            onChange={(event) => setStudentCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <RemixIcon icon="solar:user-id-bold" />
                  </InputAdornment>
                ),
              },
            }}
          />

          <Button
            fullWidth
            size="large"
            variant="contained"
            loading={loginMutation.isPending}
            disabled={!studentCode.trim()}
            onClick={submit}
            sx={{ mt: 2 }}
          >
            เข้าดูข้อมูลนักเรียน
          </Button>

          <Alert severity="success" variant="outlined" sx={{ mt: 3 }}>
            ระบบจะตรวจสอบรหัสนักเรียนกับบัญชี LINE ผู้ปกครองที่โรงเรียนยืนยันและเชื่อมไว้
          </Alert>
        </Box>
      </Card>
    </Container>
  );
}
