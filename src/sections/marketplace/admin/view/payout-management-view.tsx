'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { formatPrice } from '../../shared/api';

type AvailableSeller = {
  sellerId: string;
  amount: number;
  seller: { display_name: string } | null;
  account: { bank_name: string; account_number: string; account_name: string } | null;
};
type Payout = {
  id: string;
  amount: number;
  status: string;
  bank_name_snapshot: string;
  account_number_snapshot: string;
  account_name_snapshot: string;
  created_at: string;
  seller: { display_name: string } | null;
};

export function MarketplacePayoutManagementView() {
  const [available, setAvailable] = useState<AvailableSeller[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<{ payout: Payout; status: 'paid' | 'failed' } | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/marketplace/admin/payouts')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        setAvailable(result.availableSellers);
        setPayouts(result.payouts);
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load]);

  const createPayout = async (sellerId: string) => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/marketplace/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'สร้างรอบโอนไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const finishPayout = async () => {
    if (!reviewing) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/marketplace/admin/payouts/${reviewing.payout.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: reviewing.status,
          ...(reviewing.status === 'paid'
            ? { transferReference: value }
            : { failureReason: value }),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setReviewing(null);
      setValue('');
      load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'บันทึกผลการโอนไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography component="h1" variant="h3">โอนเงินให้ผู้ขาย</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 4 }}>
        สร้างรายการจากยอดที่พ้นระยะพัก แล้วบันทึกผลหลังโอนผ่านธนาคาร
      </Typography>
      {!!error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {loading ? <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box> : (
        <Stack spacing={4}>
          <Box>
            <Typography variant="h5" sx={{ mb: 2 }}>ยอดพร้อมทำรอบ</Typography>
            <Stack spacing={2}>
              {available.length ? available.map((item) => (
                <Card key={item.sellerId} sx={{ p: 3 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                    <div>
                      <Typography variant="h6">{item.seller?.display_name || item.sellerId}</Typography>
                      <Typography color="text.secondary">
                        {item.account
                          ? `${item.account.bank_name} · ${item.account.account_number} · ${item.account.account_name}`
                          : 'ยังไม่มีบัญชีรับเงิน'}
                      </Typography>
                    </div>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Typography variant="h5" color="success.main">{formatPrice(item.amount)}</Typography>
                      <Button
                        variant="contained"
                        disabled={!item.account}
                        loading={saving}
                        onClick={() => createPayout(item.sellerId)}
                      >
                        สร้างรายการโอน
                      </Button>
                    </Stack>
                  </Stack>
                </Card>
              )) : <Alert severity="info">ยังไม่มียอดที่พร้อมทำรอบ</Alert>}
            </Stack>
          </Box>

          <Box>
            <Typography variant="h5" sx={{ mb: 2 }}>รายการโอนล่าสุด</Typography>
            <Stack spacing={2}>
              {payouts.map((payout) => (
                <Card key={payout.id} sx={{ p: 3 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                    <div>
                      <Typography variant="h6">
                        {payout.seller?.display_name || 'ผู้ขาย'} · {formatPrice(Number(payout.amount))}
                      </Typography>
                      <Typography color="text.secondary">
                        {payout.bank_name_snapshot} · {payout.account_number_snapshot} · {payout.account_name_snapshot}
                      </Typography>
                    </div>
                    {payout.status === 'pending' ? (
                      <Stack direction="row" spacing={1}>
                        <Button color="error" onClick={() => { setReviewing({ payout, status: 'failed' }); setValue(''); }}>
                          โอนไม่สำเร็จ
                        </Button>
                        <Button variant="contained" onClick={() => { setReviewing({ payout, status: 'paid' }); setValue(''); }}>
                          บันทึกว่าโอนแล้ว
                        </Button>
                      </Stack>
                    ) : (
                      <Chip
                        color={payout.status === 'paid' ? 'success' : 'error'}
                        label={payout.status === 'paid' ? 'โอนแล้ว' : 'ไม่สำเร็จ'}
                      />
                    )}
                  </Stack>
                </Card>
              ))}
            </Stack>
          </Box>
        </Stack>
      )}

      <Dialog open={Boolean(reviewing)} onClose={() => setReviewing(null)} fullWidth maxWidth="sm">
        <DialogTitle>{reviewing?.status === 'paid' ? 'ยืนยันการโอน' : 'บันทึกว่าโอนไม่สำเร็จ'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline={reviewing?.status === 'failed'}
            minRows={reviewing?.status === 'failed' ? 3 : undefined}
            label={reviewing?.status === 'paid' ? 'เลขอ้างอิงการโอน' : 'สาเหตุ'}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <Divider />
        <DialogActions>
          <Button color="inherit" onClick={() => setReviewing(null)}>ยกเลิก</Button>
          <Button variant="contained" loading={saving} disabled={value.trim().length < 3} onClick={finishPayout}>
            ยืนยัน
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
