'use client';

import type { MarketplacePaymentSession } from '../../shared/types';

import QRCode from 'qrcode';
import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { SplashScreen } from 'src/components/loading-screen';
import {
  RiQrCodeLine,
  RiBankCardLine,
  RiUploadCloud2Line,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { formatPrice, getPaymentSession, uploadPaymentSlip } from '../../shared/api';

export function MarketplacePaymentView({
  paymentId,
  dashboardMode = false,
}: {
  paymentId: string;
  dashboardMode?: boolean;
}) {
  const router = useRouter();
  const { authenticated, loading: authLoading } = useAuthContext();
  const [session, setSession] = useState<MarketplacePaymentSession | null>(null);
  const [qrImage, setQrImage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    getPaymentSession(paymentId)
      .then((result) => setSession(result.paymentSession))
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'โหลดรายการชำระเงินไม่สำเร็จ')
      )
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  useEffect(() => {
    if (!dashboardMode && !authLoading && authenticated) {
      router.replace(paths.marketplace.dashboardPayment(paymentId));
    }
  }, [authenticated, authLoading, dashboardMode, paymentId, router]);

  useEffect(() => {
    if (!session?.promptpayPayload) return;
    QRCode.toDataURL(session.promptpayPayload, { width: 360, margin: 2 })
      .then(setQrImage)
      .catch(() => setError('สร้าง QR PromptPay ไม่สำเร็จ'));
  }, [session?.promptpayPayload]);

  if (!dashboardMode && (authLoading || authenticated)) {
    return <SplashScreen portal={false} />;
  }

  const submitSlip = async () => {
    if (!file) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await uploadPaymentSlip(paymentId, file);
      setSession((current) => (current ? { ...current, ...result.paymentSession } : current));
      setFile(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ส่งสลิปไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: 520, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return (
      <Container maxWidth="sm" sx={{ py: 10 }}>
        <Alert severity="error">{error || 'ไม่พบรายการชำระเงิน'}</Alert>
      </Container>
    );
  }

  const awaitingReview = session.status === 'payment_review';
  const verified = session.status === 'verified';
  const isStripe = session.payment_method === 'stripe';

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 7 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography component="h1" variant="h3">
            {isStripe ? 'ชำระผ่าน Stripe' : 'ชำระด้วย PromptPay'}
          </Typography>
          <Typography color="text.secondary">
            รายการ #{session.id.slice(0, 8).toUpperCase()}
          </Typography>
        </Box>

        {!!error && <Alert severity="error">{error}</Alert>}
        {verified ? (
          <Alert severity="success" icon={<RiCheckboxCircleLine />}>
            ยืนยันการชำระเงินแล้ว สินค้าของคุณพร้อมใช้งาน
          </Alert>
        ) : isStripe && session.status === 'pending_payment' ? (
          <Alert severity="info">
            หากชำระแล้ว ระบบกำลังรอ Stripe webhook ยืนยันยอด คุณสามารถกดรีเฟรชสถานะได้
          </Alert>
        ) : isStripe && ['rejected', 'expired'].includes(session.status) ? (
          <Alert severity="error">
            {session.rejection_reason || 'Stripe Checkout รายการนี้ไม่สามารถชำระต่อได้'}
          </Alert>
        ) : awaitingReview ? (
          <Alert severity="warning">
            ได้รับสลิปแล้ว กำลังรอผู้ดูแลตรวจสอบ คุณติดตามผลได้จากการแจ้งเตือนในระบบ
          </Alert>
        ) : session.status === 'rejected' ? (
          <Alert severity="error">
            สลิปไม่ผ่านการตรวจสอบ: {session.rejection_reason} กรุณาตรวจสอบและแนบใหม่
          </Alert>
        ) : (
          <Alert severity="info">สแกน QR ด้วยแอปธนาคาร แล้วแนบภาพสลิปด้านล่าง</Alert>
        )}

        {isStripe ? (
          <Card sx={{ p: { xs: 3, md: 5 }, textAlign: 'center' }}>
            <RiBankCardLine size={42} />
            <Typography variant="h4" sx={{ mt: 2 }}>
              ยอดชำระ {formatPrice(Number(session.amount))}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
              Stripe Checkout รองรับช่องทางที่เปิดไว้ใน Stripe Dashboard และจะยืนยันคำสั่งซื้อผ่าน
              webhook เท่านั้น
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
              {session.status === 'pending_payment' && session.stripe_checkout_url && (
                <Button
                  href={session.stripe_checkout_url}
                  variant="contained"
                  startIcon={<RiBankCardLine />}
                >
                  ไปยัง Stripe Checkout
                </Button>
              )}
              <Button variant="outlined" onClick={load}>
                รีเฟรชสถานะ
              </Button>
            </Stack>
          </Card>
        ) : (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="stretch">
            <Card sx={{ p: 3, flex: 1, textAlign: 'center' }}>
              <RiQrCodeLine size={28} />
              <Typography variant="h5" sx={{ mt: 1 }}>
                ยอดชำระ {formatPrice(Number(session.amount))}
              </Typography>
              {qrImage && !verified && (
                <Box
                  component="img"
                  src={qrImage}
                  alt="PromptPay QR Code"
                  sx={{ width: 280, maxWidth: 1, my: 2 }}
                />
              )}
              <Typography variant="subtitle1">
                {session.account_name_snapshot || 'บัญชีรับเงิน E-KRU Marketplace'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                กรุณาตรวจสอบชื่อผู้รับในแอปธนาคารก่อนยืนยันทุกครั้ง
              </Typography>
            </Card>

            <Card sx={{ p: 3, flex: 1 }}>
              <Typography variant="h5">หลักฐานการชำระเงิน</Typography>
              <Divider sx={{ my: 2 }} />
              {awaitingReview || verified ? (
                <Stack spacing={2}>
                  <Chip
                    color={verified ? 'success' : 'warning'}
                    label={verified ? 'ตรวจสอบแล้ว' : 'รอตรวจสอบ'}
                    sx={{ alignSelf: 'flex-start' }}
                  />
                  <Typography color="text.secondary">
                    ไฟล์: {session.slip_file_name || 'แนบสลิปแล้ว'}
                  </Typography>
                  {session.slipUrl && (
                    <Button href={session.slipUrl} target="_blank" variant="outlined">
                      เปิดดูสลิป
                    </Button>
                  )}
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <Button component="label" variant="outlined" startIcon={<RiUploadCloud2Line />}>
                    เลือกภาพสลิป
                    <input
                      hidden
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    />
                  </Button>
                  <Typography variant="body2" color="text.secondary">
                    {file?.name || 'รองรับ JPG, PNG, WebP ขนาดไม่เกิน 5 MB'}
                  </Typography>
                  <Button
                    variant="contained"
                    loading={submitting}
                    disabled={!file}
                    onClick={submitSlip}
                  >
                    ส่งสลิปให้ตรวจสอบ
                  </Button>
                </Stack>
              )}
            </Card>
          </Stack>
        )}

        <Button component={RouterLink} href="/dashboard/purchases" color="inherit">
          ดูรายการซื้อของฉัน
        </Button>
      </Stack>
    </Container>
  );
}
