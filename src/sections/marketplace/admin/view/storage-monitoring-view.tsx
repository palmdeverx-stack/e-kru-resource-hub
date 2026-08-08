'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';

import {
  RiCloudLine,
  RiSave3Line,
  RiFolderLine,
  RiRefreshLine,
  RiDatabase2Line,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

type StorageResult = {
  summary: {
    usedBytes: number;
    capacityBytes: number;
    remainingBytes: number;
    usedPercent: number;
    objectCount: number;
    status: 'normal' | 'warning' | 'critical';
  };
  settings: {
    capacityGb: number;
    warningPercent: number;
    criticalPercent: number;
    updatedAt: string | null;
  };
  buckets: Array<{
    bucketId: string;
    objectCount: number;
    totalBytes: number;
    largestObjectBytes: number;
    lastUploadedAt: string | null;
  }>;
  measuredAt: string;
};

const bucketLabels: Record<string, string> = {
  'marketplace-product-files': 'ไฟล์สินค้าดิจิทัล',
  'marketplace-product-covers': 'รูปภาพสินค้า',
  'marketplace-seller-assets': 'รูปภาพร้านค้า',
  'marketplace-seller-documents': 'เอกสารผู้ขาย',
  'marketplace-payment-slips': 'หลักฐานการชำระเงิน',
  'marketplace-review-images': 'รูปภาพรีวิว',
  'marketplace-announcement-assets': 'รูปประกาศ',
  'marketplace-landing-banner-assets': 'แบนเนอร์หน้าหลัก',
  'profile-avatars': 'รูปโปรไฟล์',
  'school-logos': 'โลโก้โรงเรียน',
  'subject-images': 'รูปภาพวิชา',
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toLocaleString('th-TH', {
    maximumFractionDigits: unitIndex >= 3 ? 2 : 1,
  })} ${units[unitIndex]}`;
}

async function readJson(response: Response) {
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message ?? 'ระบบไม่สามารถดำเนินการได้');
  return result;
}

export function MarketplaceStorageMonitoringView() {
  const { user } = useAuthContext();
  const [data, setData] = useState<StorageResult | null>(null);
  const [capacityGb, setCapacityGb] = useState(1);
  const [warningPercent, setWarningPercent] = useState(80);
  const [criticalPercent, setCriticalPercent] = useState(90);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = (await readJson(
        await fetch('/api/marketplace/admin/storage', { cache: 'no-store' })
      )) as StorageResult;
      setData(result);
      setCapacityGb(result.settings.capacityGb);
      setWarningPercent(result.settings.warningPercent);
      setCriticalPercent(result.settings.criticalPercent);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดพื้นที่จัดเก็บไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await readJson(
        await fetch('/api/marketplace/admin/storage', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ capacityGb, warningPercent, criticalPercent }),
        })
      );
      setSuccess('บันทึกเพดานพื้นที่และระดับแจ้งเตือนแล้ว');
      await load(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'บันทึกการตั้งค่าไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'master_admin' && user?.role !== 'marketplace_admin') {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Alert severity="error">หน้านี้สำหรับผู้ดูแล Marketplace เท่านั้น</Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 10, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  const statusColor =
    data?.summary.status === 'critical'
      ? 'error'
      : data?.summary.status === 'warning'
        ? 'warning'
        : 'success';
  const statusLabel =
    data?.summary.status === 'critical'
      ? 'ใกล้เต็มมาก'
      : data?.summary.status === 'warning'
        ? 'ควรตรวจสอบ'
        : 'พื้นที่ปกติ';

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            พื้นที่จัดเก็บ
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            ตรวจสอบพื้นที่ของไฟล์ทั้งหมดใน Supabase Storage โดยไม่ต้องออกจากระบบ
          </Typography>
        </Box>
        <Button
          variant="outlined"
          loading={refreshing}
          startIcon={<RiRefreshLine />}
          onClick={() => load(true)}
        >
          รีเฟรชข้อมูล
        </Button>
      </Stack>

      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {!!success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      {data && (
        <>
          {data.summary.status !== 'normal' && (
            <Alert
              severity={data.summary.status === 'critical' ? 'error' : 'warning'}
              sx={{ mb: 3 }}
            >
              ใช้พื้นที่แล้ว {data.summary.usedPercent.toFixed(1)}% กรุณาตรวจสอบไฟล์ขนาดใหญ่
              หรือลบไฟล์ที่ไม่ใช้งานก่อนถึงเพดาน
            </Alert>
          )}

          <Box
            sx={{
              gap: 2,
              mb: 3,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
            }}
          >
            {[
              {
                label: 'ใช้พื้นที่แล้ว',
                value: formatBytes(data.summary.usedBytes),
                icon: RiDatabase2Line,
              },
              {
                label: 'คงเหลือถึงเพดาน',
                value: formatBytes(data.summary.remainingBytes),
                icon: RiCloudLine,
              },
              {
                label: 'จำนวนไฟล์',
                value: data.summary.objectCount.toLocaleString('th-TH'),
                icon: RiFolderLine,
              },
              {
                label: 'สถานะ',
                value: statusLabel,
                icon: RiCloudLine,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.label} variant="outlined" sx={{ p: 2.5 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        p: 1,
                        display: 'flex',
                        borderRadius: 1.25,
                        color: `${statusColor}.dark`,
                        bgcolor: `${statusColor}.lighter`,
                      }}
                    >
                      <Icon size={22} />
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {item.label}
                      </Typography>
                      <Typography variant="h5">{item.value}</Typography>
                    </Box>
                  </Stack>
                </Card>
              );
            })}
          </Box>

          <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
              <Typography variant="h6">การใช้พื้นที่โดยรวม</Typography>
              <Chip color={statusColor} variant="soft" label={statusLabel} />
            </Stack>
            <LinearProgress
              variant="determinate"
              color={statusColor}
              value={Math.min(100, data.summary.usedPercent)}
              sx={{ height: 12, borderRadius: 99, my: 2 }}
            />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2">
                {formatBytes(data.summary.usedBytes)} จาก {formatBytes(data.summary.capacityBytes)}
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {data.summary.usedPercent.toFixed(1)}%
              </Typography>
            </Stack>
          </Card>

          <Box
            sx={{
              gap: 3,
              display: 'grid',
              alignItems: 'start',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 380px' },
            }}
          >
            <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
              <Typography variant="h6">แยกตามพื้นที่จัดเก็บ</Typography>
              <Divider sx={{ my: 2 }} />
              <Stack divider={<Divider flexItem />}>
                {data.buckets.length ? (
                  data.buckets.map((bucket) => (
                    <Box key={bucket.bucketId} sx={{ py: 1.75 }}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Box>
                          <Typography variant="subtitle2">
                            {bucketLabels[bucket.bucketId] ?? bucket.bucketId}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {bucket.bucketId} · {bucket.objectCount.toLocaleString('th-TH')} ไฟล์
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: { sm: 'right' } }}>
                          <Typography variant="subtitle2">
                            {formatBytes(bucket.totalBytes)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ไฟล์ใหญ่สุด {formatBytes(bucket.largestObjectBytes)}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  ))
                ) : (
                  <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    ยังไม่มีไฟล์ใน Storage
                  </Typography>
                )}
              </Stack>
            </Card>

            <Card variant="outlined" sx={{ p: 3 }}>
              <Typography variant="h6">ตั้งค่าแจ้งเตือน</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
                กำหนดเพดานที่ต้องการเฝ้าระวัง ระบบจะเทียบกับไฟล์จริงทุก Bucket
              </Typography>
              <Stack spacing={2}>
                <TextField
                  type="number"
                  label="เพดานพื้นที่ (GB)"
                  value={capacityGb}
                  onChange={(event) => setCapacityGb(Number(event.target.value))}
                  slotProps={{ htmlInput: { min: 0.1, step: 0.1 } }}
                />
                <TextField
                  type="number"
                  label="เตือนสีเหลืองเมื่อใช้ (%)"
                  value={warningPercent}
                  onChange={(event) => setWarningPercent(Number(event.target.value))}
                  slotProps={{ htmlInput: { min: 1, max: 99, step: 1 } }}
                />
                <TextField
                  type="number"
                  label="เตือนสีแดงเมื่อใช้ (%)"
                  value={criticalPercent}
                  onChange={(event) => setCriticalPercent(Number(event.target.value))}
                  slotProps={{ htmlInput: { min: 2, max: 100, step: 1 } }}
                />
                <Button
                  variant="contained"
                  loading={saving}
                  startIcon={<RiSave3Line />}
                  onClick={save}
                >
                  บันทึกการตั้งค่า
                </Button>
              </Stack>
            </Card>
          </Box>
        </>
      )}
    </Container>
  );
}
