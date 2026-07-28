'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { RiMailCheckLine } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';
import { verifyEmailCode, resendVerificationCode } from 'src/auth/context/jwt';

const RESEND_SECONDS = 60;

export function MarketplaceEmailVerificationView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email')?.trim().toLowerCase() ?? '';
  const { checkUserSession } = useAuthContext();
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('กรุณากรอกรหัสยืนยัน 6 หลัก');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await verifyEmailCode({ email, code });
      await checkUserSession?.();
      router.replace(paths.marketplace.dashboard);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'ไม่สามารถยืนยันอีเมลได้');
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError('');
    setMessage('');
    try {
      const result = await resendVerificationCode(email);
      setMessage(result.message);
      setCode('');
      setCountdown(RESEND_SECONDS);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'ไม่สามารถส่งรหัสใหม่ได้');
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <Alert severity="warning">
        ไม่พบอีเมลสำหรับยืนยัน กรุณา{' '}
        <RouterLink href={paths.auth.jwt.signUp}>สมัครสมาชิกใหม่</RouterLink>
      </Alert>
    );
  }

  return (
    <Box sx={{ width: 1, textAlign: 'center' }}>
      <Box
        sx={{
          width: 72,
          height: 72,
          mx: 'auto',
          display: 'grid',
          borderRadius: 3,
          placeItems: 'center',
          color: 'primary.main',
          bgcolor: 'primary.lighter',
        }}
      >
        <RiMailCheckLine size={38} />
      </Box>

      <Typography component="h1" variant="h4" sx={{ mt: 3 }}>
        ยืนยันอีเมลของคุณ
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        ส่งรหัส 6 หลักไปที่
      </Typography>
      <Typography variant="subtitle1">{maskEmail(email)}</Typography>

      {!!error && (
        <Alert severity="error" sx={{ mt: 3, textAlign: 'left' }}>
          {error}
        </Alert>
      )}
      {!!message && (
        <Alert severity="success" sx={{ mt: 3, textAlign: 'left' }}>
          {message}
        </Alert>
      )}

      <TextField
        fullWidth
        autoFocus
        value={code}
        placeholder="000000"
        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') verify();
        }}
        slotProps={{
          htmlInput: {
            inputMode: 'numeric',
            autoComplete: 'one-time-code',
            maxLength: 6,
            'aria-label': 'รหัสยืนยัน 6 หลัก',
          },
        }}
        sx={{
          mt: 3,
          '& input': {
            py: 2,
            fontSize: 30,
            fontWeight: 700,
            textAlign: 'center',
            letterSpacing: 12,
          },
        }}
      />

      <Button
        fullWidth
        size="large"
        variant="contained"
        loading={submitting}
        disabled={code.length !== 6}
        onClick={verify}
        sx={{ mt: 2 }}
      >
        ยืนยันและเข้าใช้งาน
      </Button>

      <Button
        fullWidth
        color="inherit"
        loading={resending}
        disabled={countdown > 0}
        onClick={resend}
        sx={{ mt: 1 }}
      >
        {countdown > 0 ? `ส่งรหัสใหม่ได้ใน ${countdown} วินาที` : 'ส่งรหัสใหม่'}
      </Button>

      <Button component={RouterLink} href={paths.auth.jwt.signUp} color="inherit" sx={{ mt: 1 }}>
        เปลี่ยนอีเมล
      </Button>
    </Box>
  );
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const visible = name.slice(0, Math.min(3, name.length));
  return `${visible}${'*'.repeat(Math.max(2, name.length - visible.length))}@${domain}`;
}
