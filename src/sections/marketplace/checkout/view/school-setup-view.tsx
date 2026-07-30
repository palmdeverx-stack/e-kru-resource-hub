'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { RiSchoolLine, RiShieldCheckLine } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

export function MarketplaceSchoolSetupView({ token }: { token: string }) {
  const { user, loading, authenticated } = useAuthContext();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');
  const [childDataAccepted, setChildDataAccepted] = useState(false);
  const [dpaAccepted, setDpaAccepted] = useState(false);

  useEffect(() => {
    fetch(`/api/marketplace/school-onboarding/${token}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        if (result.onboarding.completed_at) setCompleted(true);
        if (
          !result.onboarding.completed_at &&
          new Date(result.onboarding.expires_at) <= new Date()
        ) {
          throw new Error('ลิงก์สร้างโรงเรียนหมดอายุแล้ว');
        }
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'ตรวจสอบลิงก์ไม่สำเร็จ')
      )
      .finally(() => setValidating(false));
  }, [token]);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/marketplace/school-onboarding/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, childDataAccepted, dpaAccepted }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'สร้างโรงเรียนไม่สำเร็จ');
      setCompleted(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'สร้างโรงเรียนไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (loading || validating) {
    return (
      <Box sx={{ minHeight: 520, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const signInHref = `${paths.auth.jwt.signIn}?returnTo=${encodeURIComponent(
    `/school/setup/${token}`
  )}`;

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
      <Card sx={{ p: { xs: 3, sm: 5 }, borderRadius: 4 }}>
        <Box
          sx={{
            width: 72,
            height: 72,
            display: 'grid',
            borderRadius: 3,
            placeItems: 'center',
            color: completed ? 'success.main' : 'primary.main',
            bgcolor: completed ? 'success.lighter' : 'primary.lighter',
          }}
        >
          {completed ? <RiShieldCheckLine size={38} /> : <RiSchoolLine size={38} />}
        </Box>
        <Typography component="h1" variant="h3" sx={{ mt: 3 }}>
          {completed ? 'เปิดใช้งาน License แล้ว' : 'สร้างโรงเรียนเพื่อรับ License'}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {completed
            ? 'โรงเรียนถูกสร้างและ License จากคำสั่งซื้อถูกเปิดใช้งานเรียบร้อยแล้ว'
            : 'อายุ License จะเริ่มนับหลังจากสร้างโรงเรียนสำเร็จ'}
        </Typography>

        {!!error && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {error}
          </Alert>
        )}

        {completed ? (
          <Button
            fullWidth
            size="large"
            variant="contained"
            component={RouterLink}
            href="/dashboard/school-entitlements"
            sx={{ mt: 4 }}
          >
            ดูสิทธิ์และ License
          </Button>
        ) : !authenticated ? (
          <Button
            fullWidth
            size="large"
            variant="contained"
            component={RouterLink}
            href={signInHref}
            sx={{ mt: 4 }}
          >
            เข้าสู่ระบบด้วยบัญชีที่ซื้อ
          </Button>
        ) : user?.role !== 'marketplace_user' ? (
          <Alert severity="warning" sx={{ mt: 3 }}>
            กรุณาเข้าสู่ระบบด้วยบัญชีสมาชิก Marketplace ที่ใช้ซื้อ License
          </Alert>
        ) : (
          <Stack spacing={2.5} sx={{ mt: 4 }}>
            <TextField
              required
              label="ชื่อโรงเรียน"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <TextField
              required
              label="รหัสโรงเรียน 8 หลัก"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={childDataAccepted}
                  onChange={(event) => setChildDataAccepted(event.target.checked)}
                />
              }
              label={
                <Typography variant="body2">
                  รับทราบ{' '}
                  <Link component={RouterLink} href={paths.legal.childDataPolicy} target="_blank">
                    นโยบายข้อมูลเด็กและนักเรียน
                  </Link>
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={dpaAccepted}
                  onChange={(event) => setDpaAccepted(event.target.checked)}
                />
              }
              label={
                <Typography variant="body2">
                  ยอมรับ{' '}
                  <Link
                    component={RouterLink}
                    href={paths.legal.dataProcessingAgreement}
                    target="_blank"
                  >
                    ข้อตกลงการประมวลผลข้อมูล (DPA)
                  </Link>
                </Typography>
              }
            />
            <Button
              size="large"
              variant="contained"
              loading={saving}
              disabled={
                name.trim().length < 2 || code.length !== 8 || !childDataAccepted || !dpaAccepted
              }
              onClick={submit}
            >
              สร้างโรงเรียนและเปิดใช้งาน License
            </Button>
          </Stack>
        )}
      </Card>
    </Container>
  );
}
