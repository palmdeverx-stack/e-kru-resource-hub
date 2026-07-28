'use client';

import { useState, useEffect } from 'react';

import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { formatPrice } from '../../shared/api';

type FinanceResult = {
  balance: { available: number; pending: number; paid: number };
  payouts: Array<{
    id: string;
    amount: number;
    status: string;
    transfer_reference: string | null;
    created_at: string;
  }>;
};

export function MarketplaceSellerFinanceView() {
  const [data, setData] = useState<FinanceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/marketplace/seller/finance')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        setData(result);
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CircularProgress sx={{ m: 6 }} />;

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography component="h1" variant="h3">
        รายได้และการรับเงิน
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 4 }}>
        ยอดขายจะพร้อมโอนเมื่อพ้นระยะพักยอด ผู้ดูแลจะโอนตามรอบที่กำหนด
      </Typography>
      {!!error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {[
          ['ยอดพร้อมโอน', data?.balance.available ?? 0, 'success.main'],
          ['ยอดพักรอ', data?.balance.pending ?? 0, 'warning.main'],
          ['โอนแล้วทั้งหมด', data?.balance.paid ?? 0, 'primary.main'],
        ].map(([label, amount, color]) => (
          <Grid key={String(label)} size={{ xs: 12, md: 4 }}>
            <Card sx={{ p: 3 }}>
              <Typography color="text.secondary">{label}</Typography>
              <Typography variant="h3" sx={{ color }}>
                {formatPrice(Number(amount))}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ p: 3, mt: 3 }}>
        <Typography variant="h5">ประวัติการโอน</Typography>
        <Divider sx={{ my: 2 }} />
        <Stack divider={<Divider flexItem />}>
          {data?.payouts.length ? (
            data.payouts.map((payout) => (
              <Stack
                key={payout.id}
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                spacing={1}
                sx={{ py: 1.5 }}
              >
                <div>
                  <Typography variant="subtitle2">
                    {formatPrice(Number(payout.amount))}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(payout.created_at).toLocaleString('th-TH')}
                  </Typography>
                </div>
                <Typography variant="body2">
                  {payout.status === 'paid'
                    ? `โอนแล้ว${payout.transfer_reference ? ` · ${payout.transfer_reference}` : ''}`
                    : payout.status === 'failed'
                      ? 'ไม่สำเร็จ'
                      : 'รอโอน'}
                </Typography>
              </Stack>
            ))
          ) : (
            <Typography color="text.secondary">ยังไม่มีประวัติการโอน</Typography>
          )}
        </Stack>
      </Card>
    </Container>
  );
}
