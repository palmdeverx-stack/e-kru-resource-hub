'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { CONFIG } from 'src/global-config';
import { useTranslate } from 'src/locales';

import {
  RiRocketLine,
  RiShieldCheckLine,
  RiExternalLinkLine,
  RiCalendarCheckLine,
} from 'src/components/remix-icon';

import { getLicenseAppDestination } from '../ekru-app-link';

type Entitlement = {
  id: string;
  featureKeys: string[];
  planCode: string | null;
  startsAt: string;
  expiresAt: string | null;
  subscription: {
    id: string;
    billing_cycle: 'monthly' | 'yearly';
    amount: number;
    currency: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  product: {
    id: string;
    title: string;
    titleEn: string | null;
    shortDescription: string | null;
    shortDescriptionEn: string | null;
    coverUrl: string | null;
    licenseScope: 'individual' | 'school' | 'teacher' | 'platform';
    licenseTargetSystem: 'marketplace' | 'ekru' | null;
  } | null;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'long',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

export function UserEntitlementsView() {
  const { currentLang } = useTranslate();
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workingId, setWorkingId] = useState('');

  const updateSubscription = async (entitlement: Entitlement, action: 'cancel' | 'resume') => {
    if (!entitlement.subscription) return;
    setWorkingId(entitlement.subscription.id);
    setError('');
    try {
      const response = await fetch('/api/marketplace/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entitlement.subscription.id, action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'อัปเดต Subscription ไม่สำเร็จ');
      setEntitlements((current) =>
        current.map((item) =>
          item.id === entitlement.id ? { ...item, subscription: result.subscription } : item
        )
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : 'อัปเดต Subscription ไม่สำเร็จ'
      );
    } finally {
      setWorkingId('');
    }
  };

  const openBillingPortal = async () => {
    setError('');
    try {
      const response = await fetch('/api/marketplace/subscriptions/portal', { method: 'POST' });
      const result = await response.json();
      if (!response.ok || !result.url)
        throw new Error(result.message ?? 'เปิดหน้าจัดการบัตรไม่สำเร็จ');
      window.location.assign(result.url);
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : 'เปิดหน้าจัดการบัตรไม่สำเร็จ');
    }
  };

  useEffect(() => {
    fetch('/api/marketplace/user-entitlements', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? 'โหลดสิทธิ์ส่วนบุคคลไม่สำเร็จ');
        setEntitlements(result.entitlements ?? []);
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'โหลดสิทธิ์ไม่สำเร็จ')
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ color: 'primary.main' }}>
          <RiRocketLine size={34} />
        </Box>
        <Box>
          <Typography component="h1" variant="h3">
            แอปและสิทธิ์ของฉัน
          </Typography>
          <Typography color="text.secondary">
            แพ็กเกจ E-KRU ส่วนบุคคลและสิทธิ์ที่เปิดให้ทุกคนในแพลตฟอร์ม
          </Typography>
        </Box>
      </Stack>

      {!!error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ py: 12, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : entitlements.length ? (
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {entitlements.map((entitlement) => {
            const title =
              currentLang.value === 'en' && entitlement.product?.titleEn
                ? entitlement.product.titleEn
                : (entitlement.product?.title ?? 'E-KRU App');
            const description =
              currentLang.value === 'en' && entitlement.product?.shortDescriptionEn
                ? entitlement.product.shortDescriptionEn
                : entitlement.product?.shortDescription;
            const isSchoolEntitlement = entitlement.product?.licenseScope === 'school';
            const isPlatformEntitlement = entitlement.product?.licenseScope === 'platform';
            const destination = getLicenseAppDestination({
              baseUrl: CONFIG.ekruUrl,
              targetSystem: entitlement.product?.licenseTargetSystem,
              featureKeys: entitlement.featureKeys,
            });
            return (
              <Grid key={entitlement.id} size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ height: 1, overflow: 'hidden', borderRadius: 3 }}>
                  {entitlement.product?.coverUrl && (
                    <Box
                      component="img"
                      src={entitlement.product.coverUrl}
                      alt={title}
                      sx={{ width: 1, height: 210, display: 'block', objectFit: 'cover' }}
                    />
                  )}
                  <Stack spacing={2} sx={{ p: 3 }}>
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                      <Box>
                        <Typography variant="h5">{title}</Typography>
                        {!!description && (
                          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                            {description}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        color="success"
                        variant="soft"
                        icon={<RiShieldCheckLine />}
                        label={
                          isPlatformEntitlement
                            ? 'สิทธิ์ทุกคนในแพลตฟอร์ม'
                            : isSchoolEntitlement
                              ? 'สิทธิ์จากโรงเรียน'
                              : 'สิทธิ์บุคคล'
                        }
                      />
                    </Stack>
                    <Alert severity="success" icon={<RiCalendarCheckLine />}>
                      {entitlement.expiresAt
                        ? `ใช้งานได้ถึง ${formatDate(entitlement.expiresAt)}`
                        : 'สิทธิ์ถาวร · ไม่มีวันหมดอายุ'}
                    </Alert>
                    {entitlement.subscription && (
                      <Alert
                        severity={
                          entitlement.subscription.status === 'past_due' ? 'warning' : 'info'
                        }
                      >
                        <Typography variant="subtitle2">
                          ต่ออายุอัตโนมัติ
                          {entitlement.subscription.billing_cycle === 'yearly'
                            ? 'รายปี'
                            : 'รายเดือน'}{' '}
                          ·{' '}
                          {Number(entitlement.subscription.amount).toLocaleString('th-TH', {
                            style: 'currency',
                            currency: entitlement.subscription.currency,
                          })}
                        </Typography>
                        <Typography variant="body2">
                          {entitlement.subscription.status === 'past_due'
                            ? 'ตัดเงินไม่สำเร็จ กรุณาแก้ไขวิธีชำระเงิน'
                            : entitlement.subscription.cancel_at_period_end
                              ? `ยกเลิกการต่ออายุแล้ว ใช้ได้ถึง ${formatDate(entitlement.subscription.current_period_end!)}`
                              : `ตัดเงินรอบถัดไป ${formatDate(entitlement.subscription.current_period_end!)}`}
                        </Typography>
                        <Button
                          size="small"
                          color={
                            entitlement.subscription.cancel_at_period_end ? 'primary' : 'error'
                          }
                          disabled={workingId === entitlement.subscription.id}
                          onClick={() =>
                            updateSubscription(
                              entitlement,
                              entitlement.subscription!.cancel_at_period_end ? 'resume' : 'cancel'
                            )
                          }
                          sx={{ mt: 1 }}
                        >
                          {entitlement.subscription.cancel_at_period_end
                            ? 'เปิดต่ออายุอีกครั้ง'
                            : 'ยกเลิกเมื่อสิ้นสุดรอบ'}
                        </Button>
                        <Button size="small" onClick={openBillingPortal} sx={{ mt: 1, ml: 1 }}>
                          จัดการบัตรและใบแจ้งหนี้
                        </Button>
                      </Alert>
                    )}
                    {!!destination.href && (
                      <Button
                        fullWidth
                        variant="contained"
                        href={destination.href}
                        target={destination.external ? '_blank' : undefined}
                        rel={destination.external ? 'noopener noreferrer' : undefined}
                        endIcon={<RiExternalLinkLine />}
                      >
                        {destination.label}
                      </Button>
                    )}
                  </Stack>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <Card
          variant="outlined"
          sx={{ mt: 3, py: 9, px: 3, textAlign: 'center', borderStyle: 'dashed' }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              mx: 'auto',
              display: 'grid',
              borderRadius: 3,
              placeItems: 'center',
              color: 'primary.main',
              bgcolor: 'primary.lighter',
            }}
          >
            <RiRocketLine size={48} />
          </Box>
          <Typography variant="h5" sx={{ mt: 3 }}>
            ยังไม่มีแพ็กเกจส่วนบุคคล
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            เมื่อซื้อแอปหรือระบบย่อยของ E-KRU สิทธิ์จะแสดงที่หน้านี้อัตโนมัติ
          </Typography>
        </Card>
      )}
    </Container>
  );
}
