'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { useSearchParams } from 'src/routes/hooks';

import { useAuthContext } from '../../hooks';

export function JwtLineView() {
  const { user, loading, setSessionUser } = useAuthContext();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const autoStarted = useRef(false);
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
        if (!cancelled) {
          setReady(true);
        }
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

  const continueWithLine = useCallback(async () => {
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
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, action: user ? 'link' : 'login' }),
      });
      const result = await response.json();
      if (!response.ok) {
        setNeedsLink(Boolean(result.needsLink));
        throw new Error(result.message ?? 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ');
      }
      // Confirm the browser accepted the session cookie before navigating away.
      const sessionResponse = await fetch('/api/auth/me', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!sessionResponse.ok) {
        throw new Error(
          'LINE ยืนยันสำเร็จ แต่ไม่สามารถสร้าง session ของ E-KRU ได้ กรุณาเปิดเว็บบนโดเมนเดิมและลองใหม่'
        );
      }
      const session = await sessionResponse.json();
      if (!session.user) throw new Error('ไม่พบ session ของ E-KRU กรุณาลองใหม่');
      setSessionUser?.(session.user);
      window.location.assign(returnTo);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เชื่อมต่อ LINE ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }, [resume, returnTo, setSessionUser, user]);

  useEffect(() => {
    // Login may continue automatically; linking always requires explicit confirmation.
    if (!ready || loading || user || autoStarted.current) return;
    autoStarted.current = true;
    void continueWithLine();
  }, [continueWithLine, loading, ready, user]);

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Typography variant="h5">เข้าสู่ระบบด้วย LINE</Typography>
      <Typography>
        {user
          ? `เชื่อม LINE กับบัญชี ${user.username}`
          : error
            ? 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ'
            : 'กำลังเชื่อมต่อ LINE กรุณารอสักครู่…'}
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {!user && !error && <CircularProgress size={28} sx={{ mx: 'auto' }} />}
      {(user || (error && !needsLink)) && (
        <Button
          variant="contained"
          disabled={!ready || loading}
          loading={busy}
          onClick={continueWithLine}
        >
          {user ? 'ยืนยันเชื่อมบัญชี LINE' : 'ลองอีกครั้ง'}
        </Button>
      )}
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
