'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import {
  RiFileCopyLine,
  RiShareForwardLine,
  RiMoneyDollarCircleLine,
} from 'src/components/remix-icon';

type ReferralData = {
  enabled: boolean;
  settings: {
    rewardRate: number;
    attributionDays: number;
    holdDays: number;
    minimumPayout: number;
  };
  code: { value: string; link: string } | null;
  summary: { clicks: number; pending: number; available: number; paid: number };
  rewards: Array<{
    id: string;
    order_id: string;
    reward_amount: number;
    currency: string;
    status: 'pending' | 'available' | 'paid' | 'cancelled';
    available_at: string;
    created_at: string;
    order?: { items?: Array<{ title?: string }> } | null;
  }>;
};

const money = (value: number) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value);

export function MarketplaceReferralView() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/marketplace/referrals', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        return result as ReferralData;
      })
      .then(setData)
      .catch((loadError) => setError(loadError.message));
  }, []);

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }
  if (!data) return <CircularProgress sx={{ m: 6 }} />;
  if (!data.enabled) {
    return (
      <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
        <Alert severity="info">
          ขณะนี้ระบบแนะนำเพื่อนยังไม่เปิดใช้งาน เมื่อเปิดอีกครั้ง เมนูนี้จะแสดงอัตโนมัติ
        </Alert>
      </Container>
    );
  }

  const copyLink = async () => {
    if (!data.code) return;
    await navigator.clipboard.writeText(data.code.link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const shareLink = async () => {
    if (!data.code) return;
    if (navigator.share) {
      await navigator.share({
        title: 'E-KRU Marketplace',
        text: 'เลือกดูสื่อการสอนคุณภาพจาก E-KRU Marketplace',
        url: data.code.link,
      });
    } else {
      await copyLink();
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Typography component="h1" variant="h3">
        แนะนำเพื่อน
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.75 }}>
        แชร์ลิงก์ให้เพื่อน เมื่อเพื่อนซื้อสินค้าที่ร่วมรายการ คุณจะได้รับรางวัลจากค่าธรรมเนียม
        Marketplace
      </Typography>

      <Alert severity="info" sx={{ mt: 3 }}>
        รับ {data.settings.rewardRate}% ของค่าธรรมเนียมแพลตฟอร์ม · ลิงก์มีผล{' '}
        {data.settings.attributionDays} วัน · พักยอด {data.settings.holdDays} วัน
      </Alert>

      <Card sx={{ p: { xs: 2.5, md: 4 }, mt: 3 }}>
        <Typography variant="h6">ลิงก์แนะนำของคุณ</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
          <TextField
            fullWidth
            value={data.code?.link ?? ''}
            slotProps={{ input: { readOnly: true } }}
          />
          <Button
            variant="outlined"
            startIcon={<RiFileCopyLine />}
            onClick={copyLink}
            sx={{ flexShrink: 0 }}
          >
            {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
          </Button>
          <Button
            variant="contained"
            startIcon={<RiShareForwardLine />}
            onClick={shareLink}
            sx={{ flexShrink: 0 }}
          >
            แชร์
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Referral Code: {data.code?.value}
        </Typography>
      </Card>

      <Box
        sx={{
          mt: 3,
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
        }}
      >
        <SummaryCard label="จำนวนคลิก" value={data.summary.clicks.toLocaleString('th-TH')} />
        <SummaryCard label="รอพักยอด" value={money(data.summary.pending)} />
        <SummaryCard label="พร้อมรับเงิน" value={money(data.summary.available)} />
        <SummaryCard label="จ่ายแล้ว" value={money(data.summary.paid)} />
      </Box>

      <Card sx={{ mt: 3 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ p: 3, pb: 1.5 }}>
          <Typography variant="h6">ประวัติรางวัล</Typography>
          <Typography variant="body2" color="text.secondary">
            ยอดขั้นต่ำสำหรับรอบจ่าย {money(data.settings.minimumPayout)}
          </Typography>
        </Stack>
        {data.rewards.length ? (
          <TableContainer>
            <Table>
              <TableBody>
                {data.rewards.map((reward) => (
                  <TableRow key={reward.id}>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {reward.order?.items?.[0]?.title ||
                          `คำสั่งซื้อ ${reward.order_id.slice(0, 8)}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(reward.created_at).toLocaleString('th-TH')}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle2" color="success.main">
                        +{money(Number(reward.reward_amount))}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <RewardStatus status={reward.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Stack alignItems="center" sx={{ px: 3, py: 7 }}>
            <RiMoneyDollarCircleLine size={48} color="#919EAB" />
            <Typography variant="h6" sx={{ mt: 1.5 }}>
              ยังไม่มีรางวัลจากการแนะนำ
            </Typography>
            <Typography color="text.secondary">แชร์ลิงก์ให้เพื่อนเพื่อเริ่มรับรางวัล</Typography>
          </Stack>
        )}
      </Card>
    </Container>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ mt: 1 }}>
        {value}
      </Typography>
    </Card>
  );
}

function RewardStatus({ status }: { status: ReferralData['rewards'][number]['status'] }) {
  const config = {
    pending: { label: 'รอพักยอด', color: 'warning' },
    available: { label: 'พร้อมรับเงิน', color: 'success' },
    paid: { label: 'จ่ายแล้ว', color: 'info' },
    cancelled: { label: 'ยกเลิก', color: 'default' },
  } as const;
  const item = config[status];
  return <Chip size="small" label={item.label} color={item.color} variant="soft" />;
}
