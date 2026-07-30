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

type Entitlement = {
  id: string;
  featureKeys: string[];
  planCode: string | null;
  startsAt: string;
  expiresAt: string | null;
  product: {
    id: string;
    title: string;
    titleEn: string | null;
    shortDescription: string | null;
    shortDescriptionEn: string | null;
    coverUrl: string | null;
  } | null;
};

function formatDate(value: string) {
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

  const ekruHref = CONFIG.ekruUrl
    ? `${CONFIG.ekruUrl.replace(/\/+$/, '')}/dashboard?source=marketplace`
    : '';

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
            แพ็กเกจ E-KRU ที่ซื้อด้วยบัญชีนี้และไม่ขึ้นกับโรงเรียน
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
                        label="สิทธิ์บุคคล"
                      />
                    </Stack>
                    <Alert severity="success" icon={<RiCalendarCheckLine />}>
                      {entitlement.expiresAt
                        ? `ใช้งานได้ถึง ${formatDate(entitlement.expiresAt)}`
                        : 'สิทธิ์ถาวร · ไม่มีวันหมดอายุ'}
                    </Alert>
                    {!!ekruHref && (
                      <Button
                        fullWidth
                        variant="contained"
                        href={ekruHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        endIcon={<RiExternalLinkLine />}
                      >
                        เปิดใช้งานใน e-Kru
                      </Button>
                    )}
                  </Stack>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <Card variant="outlined" sx={{ mt: 4, py: 9, px: 3, textAlign: 'center' }}>
          <RiRocketLine size={48} />
          <Typography variant="h5" sx={{ mt: 2 }}>
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
