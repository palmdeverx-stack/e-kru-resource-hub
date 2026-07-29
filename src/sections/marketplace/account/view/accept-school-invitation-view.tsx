'use client';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useSearchParams } from 'src/routes/hooks';

import { getSupabaseBrowserClient } from 'src/lib/supabase-browser';

import {
  RiSchoolLine,
  RiLoginBoxLine,
  RiShieldCheckLine,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

import { signOut } from 'src/auth/context/jwt';
import { useAuthContext } from 'src/auth/hooks';

type ViewStatus = 'ready' | 'accepting' | 'accepted' | 'invalid' | 'session_required' | 'error';

function signInUrl(token: string, invitationId: string) {
  const query = token
    ? `token=${encodeURIComponent(token)}`
    : `id=${encodeURIComponent(invitationId)}`;
  const returnTo = `/invitations/accept?${query}`;
  return `${paths.auth.jwt.signIn}?returnTo=${encodeURIComponent(returnTo)}`;
}

function invitationErrorMessage(message: string) {
  if (message.includes('Invitation is invalid or expired')) {
    return 'คำเชิญนี้ไม่ถูกต้อง หมดอายุ ถูกยกเลิก หรือถูกใช้งานไปแล้ว';
  }
  if (message.includes('Marketplace account not found')) {
    return 'บัญชีที่เข้าสู่ระบบไม่ตรงกับบัญชี Marketplace ที่ได้รับคำเชิญ';
  }
  return message || 'ไม่สามารถตอบรับคำเชิญได้ กรุณาลองใหม่อีกครั้ง';
}

export function AcceptSchoolInvitationView() {
  const searchParams = useSearchParams();
  const initialToken = useRef(searchParams.get('token')?.trim() ?? '');
  const initialInvitationId = useRef(searchParams.get('id')?.trim() ?? '');
  const hasInvitation = Boolean(initialToken.current || initialInvitationId.current);
  const { user, loading, authenticated } = useAuthContext();
  const [status, setStatus] = useState<ViewStatus>(hasInvitation ? 'ready' : 'invalid');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (loading || authenticated || !hasInvitation) return;
    window.location.replace(signInUrl(initialToken.current, initialInvitationId.current));
  }, [authenticated, hasInvitation, loading]);

  const acceptInvitation = async () => {
    if (!initialToken.current && !initialInvitationId.current) {
      setStatus('invalid');
      return;
    }
    if (user?.role !== 'marketplace_user') {
      setMessage('กรุณาเข้าสู่ระบบด้วยบัญชี Marketplace ที่ได้รับคำเชิญ');
      setStatus('error');
      return;
    }

    setStatus('accepting');
    setMessage('');
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatus('session_required');
        return;
      }

      const { error } = initialToken.current
        ? await supabase.rpc('accept_marketplace_school_invitation', {
            invite_token: initialToken.current,
          })
        : await supabase.rpc('accept_marketplace_school_invitation_by_id', {
            invitation_id: initialInvitationId.current,
          });
      if (error) throw error;

      setStatus('accepted');
      window.history.replaceState(null, '', '/invitations/accept?accepted=1');
      initialToken.current = '';
      initialInvitationId.current = '';
    } catch (acceptError) {
      setMessage(
        invitationErrorMessage(
          acceptError instanceof Error ? acceptError.message : 'ไม่สามารถตอบรับคำเชิญได้'
        )
      );
      setStatus('error');
    }
  };

  const reauthenticate = async () => {
    const token = initialToken.current;
    const invitationId = initialInvitationId.current;
    await signOut();
    window.location.replace(signInUrl(token, invitationId));
  };

  if (loading || (!authenticated && status !== 'invalid')) {
    return (
      <Box sx={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const isAccepted = status === 'accepted';
  const isInvalid = status === 'invalid';

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 72px)',
        py: { xs: 6, md: 10 },
        display: 'flex',
        alignItems: 'center',
        background:
          'radial-gradient(circle at 18% 20%, rgba(21,101,245,0.14), transparent 30%), linear-gradient(180deg, #F5F9FF 0%, #FFFFFF 100%)',
      }}
    >
      <Container maxWidth="sm">
        <Card sx={{ p: { xs: 3, sm: 5 }, borderRadius: 4, textAlign: 'center', boxShadow: 12 }}>
          <Box
            sx={{
              width: 76,
              height: 76,
              mx: 'auto',
              display: 'grid',
              borderRadius: 3,
              placeItems: 'center',
              color: isAccepted ? 'success.main' : 'primary.main',
              bgcolor: isAccepted ? 'success.lighter' : 'primary.lighter',
            }}
          >
            {isAccepted ? <RiCheckboxCircleLine size={40} /> : <RiSchoolLine size={40} />}
          </Box>

          <Typography component="h1" variant="h3" sx={{ mt: 3 }}>
            {isAccepted
              ? 'เข้าร่วมโรงเรียนสำเร็จ'
              : isInvalid
                ? 'ไม่พบข้อมูลคำเชิญ'
                : 'คำเชิญเข้าร่วมโรงเรียน'}
          </Typography>

          <Typography color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.8 }}>
            {isAccepted
              ? 'บัญชี Marketplace ของคุณถูกเพิ่มเป็นสมาชิกโรงเรียนแล้ว'
              : isInvalid
                ? 'กรุณาเปิดหน้านี้จากลิงก์ที่ได้รับทางอีเมล'
                : 'โรงเรียนเชิญบัญชี Marketplace ของคุณเข้าร่วมในฐานะครู กรุณาตรวจสอบบัญชีและกดยืนยัน'}
          </Typography>

          {authenticated && !isAccepted && !isInvalid && (
            <Alert severity="info" icon={<RiShieldCheckLine />} sx={{ mt: 3, textAlign: 'left' }}>
              กำลังตอบรับด้วยบัญชี <strong>{user?.email ?? user?.username}</strong>
            </Alert>
          )}

          {!!message && (
            <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
              {message}
            </Alert>
          )}

          <Stack spacing={1.5} sx={{ mt: 4 }}>
            {status === 'ready' || status === 'error' ? (
              <Button
                size="large"
                variant="contained"
                disabled={!authenticated}
                startIcon={<RiCheckboxCircleLine />}
                onClick={acceptInvitation}
              >
                ยอมรับคำเชิญ
              </Button>
            ) : null}

            {status === 'accepting' && (
              <Button size="large" variant="contained" loading>
                กำลังยืนยันคำเชิญ
              </Button>
            )}

            {status === 'session_required' && (
              <>
                <Alert severity="warning" sx={{ textAlign: 'left' }}>
                  Session ของ Supabase หมดอายุ กรุณาเข้าสู่ระบบอีกครั้งเพื่อยืนยันตัวตน
                </Alert>
                <Button
                  size="large"
                  variant="contained"
                  startIcon={<RiLoginBoxLine />}
                  onClick={reauthenticate}
                >
                  เข้าสู่ระบบอีกครั้ง
                </Button>
              </>
            )}

            {(isAccepted || isInvalid) && (
              <Button
                size="large"
                variant={isAccepted ? 'contained' : 'outlined'}
                component={RouterLink}
                href={isAccepted ? paths.marketplace.dashboard : paths.marketplace.products}
              >
                {isAccepted ? 'ไปที่ Dashboard' : 'กลับไปหน้าสื่อการสอน'}
              </Button>
            )}
          </Stack>
        </Card>
      </Container>
    </Box>
  );
}
