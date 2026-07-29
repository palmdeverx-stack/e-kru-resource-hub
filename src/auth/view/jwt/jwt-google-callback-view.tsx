'use client';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { getSupabaseBrowserClient } from 'src/lib/supabase-browser';

import { RemixIcon } from 'src/components/remix-icon';

import { verifySignInPin } from '../../context/jwt';

type PinChallenge = {
  token: string;
  role: 'master_admin' | 'school_admin';
};

export function JwtGoogleCallbackView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const started = useRef(false);
  const [error, setError] = useState('');
  const [pin, setPin] = useState('');
  const [pinChallenge, setPinChallenge] = useState<PinChallenge | null>(null);
  const [verifyingPin, setVerifyingPin] = useState(false);

  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo =
    requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
      ? requestedReturnTo
      : paths.marketplace.dashboard;

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const completeGoogleSignIn = async () => {
      try {
        const oauthError = searchParams.get('error_description') ?? searchParams.get('error');
        if (oauthError) throw new Error(oauthError);

        const code = searchParams.get('code');
        if (!code) throw new Error('ไม่พบรหัสยืนยันจาก Google');

        const supabase = getSupabaseBrowserClient();
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError || !data.session?.access_token) {
          throw new Error(exchangeError?.message ?? 'สร้าง Google session ไม่สำเร็จ');
        }

        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ');

        if (result.requiresPin) {
          setPinChallenge({
            token: result.pinChallengeToken,
            role: result.role,
          });
          return;
        }

        window.location.replace(returnTo);
      } catch (callbackError) {
        setError(
          callbackError instanceof Error
            ? callbackError.message
            : 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ'
        );
      }
    };

    completeGoogleSignIn();
  }, [returnTo, searchParams]);

  const verifyPin = async () => {
    if (!pinChallenge || !/^\d{8}$/.test(pin)) {
      setError('กรุณากรอก PIN เป็นตัวเลข 8 หลัก');
      return;
    }
    setVerifyingPin(true);
    setError('');
    try {
      await verifySignInPin({ pinChallengeToken: pinChallenge.token, pin });
      window.location.replace(returnTo);
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : 'PIN ไม่ถูกต้อง');
    } finally {
      setVerifyingPin(false);
    }
  };

  return (
    <Box sx={{ width: 1, textAlign: 'center' }}>
      <Box
        sx={{
          width: 64,
          height: 64,
          mx: 'auto',
          display: 'grid',
          borderRadius: 3,
          placeItems: 'center',
          bgcolor: 'background.paper',
          boxShadow: 8,
        }}
      >
        <RemixIcon width={32} icon="socials:google" />
      </Box>

      <Typography variant="h4" sx={{ mt: 3 }}>
        {pinChallenge ? 'ยืนยัน PIN เพื่อเข้าสู่ระบบ' : 'กำลังเชื่อมต่อบัญชี Google'}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        {pinChallenge?.role === 'school_admin'
          ? 'กรอกรหัสโรงเรียน 8 หลัก'
          : pinChallenge
            ? 'กรอก PIN ผู้ดูแลระบบ 8 หลัก'
            : 'กรุณารอสักครู่ ระบบกำลังตรวจสอบบัญชีของคุณ'}
      </Typography>

      {!!error && (
        <Alert severity="error" sx={{ mt: 3, textAlign: 'left' }}>
          {error}
        </Alert>
      )}

      {pinChallenge ? (
        <Box sx={{ mt: 3 }}>
          <TextField
            fullWidth
            autoFocus
            label="PIN 8 หลัก"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          />
          <Button
            fullWidth
            size="large"
            variant="contained"
            loading={verifyingPin}
            onClick={verifyPin}
            sx={{ mt: 2 }}
          >
            ยืนยันและเข้าสู่ระบบ
          </Button>
        </Box>
      ) : !error ? (
        <CircularProgress sx={{ mt: 4 }} />
      ) : (
        <Button
          fullWidth
          size="large"
          variant="contained"
          onClick={() => router.replace(paths.auth.jwt.signIn)}
          sx={{ mt: 3 }}
        >
          กลับหน้าเข้าสู่ระบบ
        </Button>
      )}
    </Box>
  );
}

