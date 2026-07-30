'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { CONFIG } from 'src/global-config';
import { useTranslate } from 'src/locales';
import { SCHOOL_FEATURES } from 'src/lib/school-subscription-config';

import {
  RiKey2Line,
  RiSchoolLine,
  RiShieldCheckLine,
  RiExternalLinkLine,
  RiCalendarCheckLine,
} from 'src/components/remix-icon';

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
  } | null;
};

const featureMap = new Map(SCHOOL_FEATURES.map((feature) => [feature.key, feature]));

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'long',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

export function SchoolEntitlementsView() {
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
        if (!response.ok) throw new Error(result.message ?? 'โหลดสิทธิ์จากโรงเรียนไม่สำเร็จ');
        setEntitlements(result.entitlements ?? []);
      })
      .catch((loadError) => {
        if (loadError instanceof Error && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'โหลดสิทธิ์ไม่สำเร็จ');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const ekruHref = CONFIG.ekruUrl
    ? `${CONFIG.ekruUrl.replace(/\/+$/, '')}/dashboard?source=marketplace`
    : '';

  return (
    <Container maxWidth={false} sx={{ py: { xs: 4, md: 6 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'center' }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ color: 'primary.main' }}>
              <RiKey2Line size={32} />
            </Box>
            <Typography component="h1" variant="h3">
              สิทธิ์จากโรงเรียน
            </Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            สินค้าและฟีเจอร์ที่โรงเรียนเปิดสิทธิ์ให้คุณใช้งาน
          </Typography>
        </Box>
        {!!ekruHref && (
          <Button
            size="large"
            variant="contained"
            href={ekruHref}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<RiExternalLinkLine />}
          >
            เปิดใช้งานใน eKru
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
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {entitlements.map((entitlement) => {
            const title =
              currentLang.value === 'en' && entitlement.product?.titleEn
                ? entitlement.product.titleEn
                : (entitlement.product?.title ?? 'E-KRU Package');
            const description =
              currentLang.value === 'en' && entitlement.product?.shortDescriptionEn
                ? entitlement.product.shortDescriptionEn
                : entitlement.product?.shortDescription;
            const groups = new Map<string, string[]>();
            for (const featureKey of entitlement.featureKeys) {
              const feature = featureMap.get(featureKey as (typeof SCHOOL_FEATURES)[number]['key']);
              const group = feature?.group ?? 'ฟีเจอร์อื่น';
              groups.set(group, [...(groups.get(group) ?? []), feature?.label ?? featureKey]);
            }

            return (
              <Grid key={entitlement.id} size={{ xs: 12, lg: 6 }}>
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
                            {entitlement.school.name}
                          </Typography>
                        </Stack>
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

                    <Divider />

                    <Stack spacing={2}>
                      {[...groups].map(([group, labels]) => (
                        <Box key={group}>
                          <Typography variant="subtitle2">{group}</Typography>
                          <Stack
                            direction="row"
                            spacing={0.75}
                            flexWrap="wrap"
                            useFlexGap
                            sx={{ mt: 1 }}
                          >
                            {labels.map((label) => (
                              <Chip key={label} size="small" variant="soft" label={label} />
                            ))}
                          </Stack>
                        </Box>
                      ))}
                    </Stack>

                    {!!ekruHref && (
                      <Button
                        fullWidth
                        size="large"
                        variant="outlined"
                        href={ekruHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        endIcon={<RiExternalLinkLine />}
                      >
                        เปิดใช้งานใน E-KRU
                      </Button>
                    )}
                  </Stack>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <Card variant="outlined" sx={{ mt: 4, py: 10, px: 3, textAlign: 'center' }}>
          <RiSchoolLine size={48} />
          <Typography variant="h5" sx={{ mt: 2 }}>
            ยังไม่มีสิทธิ์จากโรงเรียน
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            License ทั้งโรงเรียนจะแสดงอัตโนมัติ ส่วน License รายครูต้องให้ผู้ดูแลโรงเรียนจัดสรร Seat
          </Typography>
        </Card>
      )}
    </Container>
  );
}
