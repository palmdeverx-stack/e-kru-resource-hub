'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { useSearchParams } from 'src/routes/hooks';

import { useAuthContext } from '../../hooks';

export function JwtLineView() {
  const { user, loading, checkUserSession } = useAuthContext();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsLink, setNeedsLink] = useState(false);
  const requested = searchParams.get('returnTo');
  const returnTo =
    requested?.startsWith('/') && !requested.startsWith('//') && !requested.includes('\\')
      ? requested
      : '/dashboard';
  const resume = `/auth/line?returnTo=${encodeURIComponent(returnTo)}`;

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) throw new Error('ยังไม่ได้ตั้งค่า LIFF ID');
        if (window.location.protocol !== 'https:') {
          throw new Error(
            'LINE Login ต้องเปิดผ่าน HTTPS ที่ตรงกับ LIFF Endpoint URL กรุณาใช้เว็บจริง หรือ HTTPS tunnel สำหรับ localhost:8800'
          );
        }
        const { default: liff } = await import('@line/liff');
        await liff.init({ liffId });
        if (!cancelled) setReady(true);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'เริ่มต้น LINE ไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า LIFF'
          );
        }
      }
    }
    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  const continueWithLine = async () => {
    setBusy(true);
    setError('');
    try {
      const { default: liff } = await import('@line/liff');
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: `${window.location.origin}${resume}` });
        return;
      }
      const idToken = liff.getIDToken();
      if (!idToken)
        throw new Error('ไม่พบ ID token กรุณาเปิด scope openid ใน LIFF แล้วเข้าสู่ LINE ใหม่');
      const response = await fetch('/api/auth/line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, action: user ? 'link' : 'login' }),
      });
      const result = await response.json();
      if (!response.ok) {
        setNeedsLink(Boolean(result.needsLink));
        throw new Error(result.message ?? 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ');
      }
      await checkUserSession?.();
      window.location.assign(returnTo);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เชื่อมต่อ LINE ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Typography variant="h5">เข้าสู่ระบบด้วย LINE</Typography>
      <Typography>
        {user
          ? `เชื่อม LINE กับบัญชี ${user.username}`
          : 'ใช้ LINE ที่เคยเชื่อมกับบัญชี E-KRU เพื่อเข้าสู่ระบบ'}
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Button
        variant="contained"
        disabled={!ready || loading}
        loading={busy}
        onClick={continueWithLine}
      >
        {user ? 'ยืนยันเชื่อมบัญชี LINE' : 'ดำเนินการต่อด้วย LINE'}
      </Button>
      {needsLink && !user && (
        <>
          <Button href={`/auth/sign-in?returnTo=${encodeURIComponent(resume)}`}>
            เข้าสู่ระบบ E-KRU เพื่อเชื่อมบัญชี
          </Button>
          <Button href="/auth/sign-up">สมัครสมาชิก E-KRU</Button>
        </>
      )}
    </Box>
  );
}
