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
  RiKey2Line,
  RiSchoolLine,
  RiShieldCheckLine,
  RiExternalLinkLine,
  RiCalendarCheckLine,
} from 'src/components/remix-icon';

import { getLicenseAppDestination } from '../ekru-app-link';

type Entitlement = {
  id: string;
  school: { id: string; name: string; membershipRole: string };
  licenseScope: 'school' | 'teacher';
  featureKeys: string[];
  seatCount: number;
  startsAt: string;
  expiresAt: string;
  planCode: string | null;
  limits: {
    teachers: number | null;
    students: number | null;
    schoolAdmins: number | null;
    lineQuota: number | null;
  };
  product: {
    id: string;
    title: string;
    titleEn: string | null;
    shortDescription: string | null;
    shortDescriptionEn: string | null;
    coverUrl: string | null;
    licenseTargetSystem: 'marketplace' | 'ekru' | null;
  } | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'long',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

function isPersonalEkruWorkspace(name: string) {
  return /พื้นที่ส่วนตัวของ\s*e-?kru\s*user/i.test(name.trim());
}

export function SchoolEntitlementsView({ embedded = false }: { embedded?: boolean }) {
  const { currentLang } = useTranslate();
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/marketplace/school-entitlements', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? 'โหลดสิทธิ์การใช้งานไม่สำเร็จ');
        setEntitlements(result.entitlements ?? []);
      })
      .catch((loadError) => {
        if (loadError instanceof Error && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'โหลดสิทธิ์ไม่สำเร็จ');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const primaryDestination = entitlements[0]
    ? getLicenseAppDestination({
        baseUrl: CONFIG.ekruUrl,
        role: entitlements[0].school.membershipRole,
        targetSystem: entitlements[0].product?.licenseTargetSystem,
        featureKeys: entitlements[0].featureKeys,
      })
    : null;

  return (
    <Container maxWidth={false} disableGutters={embedded} sx={{ py: embedded ? 0 : { xs: 3 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mt: embedded ? 5 : 0 }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ color: 'primary.main' }}>
              <RiKey2Line size={32} />
            </Box>
            <Typography component={embedded ? 'h2' : 'h1'} variant={embedded ? 'h4' : 'h3'}>
              {embedded ? 'สิทธิ์จากโรงเรียน' : 'สิทธิ์การใช้งาน'}
            </Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            {embedded
              ? 'แพ็กเกจและแอปที่โรงเรียนซื้อและเปิดสิทธิ์ให้คุณใช้งาน'
              : 'พื้นที่ส่วนตัวและสิทธิ์ที่โรงเรียนเปิดให้คุณใช้งาน'}
          </Typography>
        </Box>
        {!!primaryDestination?.href && (
          <Button
            size="large"
            variant="contained"
            href={primaryDestination.href}
            target={primaryDestination.external ? '_blank' : undefined}
            rel={primaryDestination.external ? 'noopener noreferrer' : undefined}
            endIcon={<RiExternalLinkLine />}
          >
            {primaryDestination.label}
          </Button>
        )}
      </Stack>

      {!!error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}
      {!CONFIG.ekruUrl && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          ยังไม่ได้กำหนด NEXT_PUBLIC_EKRU_URL จึงยังไม่สามารถเปิดกลับไปยังระบบ eKru ได้
        </Alert>
      )}

      {loading ? (
        <Box sx={{ py: 14, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : entitlements.length ? (
        <Grid container spacing={3} sx={{ mt: 3 }}>
          {entitlements.map((entitlement) => {
            const personalWorkspace = isPersonalEkruWorkspace(entitlement.school.name);
            const title =
              currentLang.value === 'en' && entitlement.product?.titleEn
                ? entitlement.product.titleEn
                : (entitlement.product?.title ?? 'E-KRU Package');
            const description =
              currentLang.value === 'en' && entitlement.product?.shortDescriptionEn
                ? entitlement.product.shortDescriptionEn
                : entitlement.product?.shortDescription;
            const destination = getLicenseAppDestination({
              baseUrl: CONFIG.ekruUrl,
              role: entitlement.school.membershipRole,
              targetSystem: entitlement.product?.licenseTargetSystem,
              featureKeys: entitlement.featureKeys,
            });
            return (
              <Grid key={entitlement.id} size={{ xs: 12, lg: 3 }}>
                <Card variant="outlined" sx={{ height: 1, overflow: 'hidden', borderRadius: 3.5 }}>
                  {entitlement.product?.coverUrl && (
                    <Box
                      component="img"
                      src={entitlement.product.coverUrl}
                      alt={title}
                      sx={{ width: 1, height: 220, display: 'block', objectFit: 'cover' }}
                    />
                  )}
                  <Stack spacing={2.5} sx={{ p: { xs: 2.5, md: 3 } }}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      spacing={1.5}
                    >
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <RiSchoolLine size={20} />
                          <Typography variant="subtitle2" color="primary.main">
                            {personalWorkspace
                              ? currentLang.value === 'en'
                                ? 'Personal E-KRU workspace'
                                : 'พื้นที่ส่วนตัว E-KRU'
                              : entitlement.school.name}
                          </Typography>
                        </Stack>
                        {personalWorkspace && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {currentLang.value === 'en'
                              ? 'Buy resources, view purchases, and keep personal access even when a school package expires.'
                              : 'ซื้อสื่อ ดูรายการซื้อ และใช้สิทธิ์ส่วนตัวได้ แม้แพ็กเกจโรงเรียนหมดอายุ'}
                          </Typography>
                        )}
                        <Typography variant="h5" sx={{ mt: 1 }}>
                          {title}
                        </Typography>
                        {!!description && (
                          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                            {description}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        color="success"
                        icon={<RiShieldCheckLine />}
                        label={
                          entitlement.licenseScope === 'school'
                            ? 'สิทธิ์ทั้งโรงเรียน'
                            : 'ได้รับ Seat แล้ว'
                        }
                      />
                    </Stack>

                    <Alert severity="success" icon={<RiCalendarCheckLine />}>
                      ใช้งานได้ถึง {formatDate(entitlement.expiresAt)}
                    </Alert>

                    {!!destination.href && (
                      <Button
                        fullWidth
                        size="large"
                        variant="outlined"
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
      ) : embedded ? null : (
        <Card variant="outlined" sx={{ mt: 4, py: 10, px: 3, textAlign: 'center' }}>
          <RiSchoolLine size={48} />
          <Typography variant="h5" sx={{ mt: 2 }}>
            ยังไม่มีสิทธิ์การใช้งาน
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            License ทั้งโรงเรียนจะแสดงอัตโนมัติ ส่วน License รายครูต้องให้ผู้ดูแลโรงเรียนจัดสรร Seat
          </Typography>
        </Card>
      )}
    </Container>
  );
}
