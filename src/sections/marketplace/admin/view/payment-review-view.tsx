'use client';

import type { MarketplacePaymentSession } from '../../shared/types';

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

import { RiCloseLine, RiErrorWarningLine, RiCheckboxCircleLine } from 'src/components/remix-icon';

import { formatPrice } from '../../shared/api';

type ReviewAction = { session: MarketplacePaymentSession; action: 'approve' | 'reject' };
type PaymentDispute = {
  id: string;
  stripe_dispute_id: string;
  amount: number;
  currency: string;
  reason: string | null;
  status: string;
  evidence_due_by: string | null;
};

export function MarketplacePaymentReviewView() {
  const [sessions, setSessions] = useState<MarketplacePaymentSession[]>([]);
  const [disputes, setDisputes] = useState<PaymentDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<ReviewAction | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/marketplace/admin/payments?status=payment_review'),
      fetch('/api/marketplace/admin/disputes'),
    ])
      .then(async ([paymentsResponse, disputesResponse]) => {
        const [paymentsResult, disputesResult] = await Promise.all([
          paymentsResponse.json(),
          disputesResponse.json(),
        ]);
        if (!paymentsResponse.ok) throw new Error(paymentsResult.message);
        if (!disputesResponse.ok) throw new Error(disputesResult.message);
        setSessions(paymentsResult.paymentSessions);
        setDisputes(disputesResult.disputes);
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  const submit = async () => {
    if (!reviewing) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(
        `/api/marketplace/admin/payments/${reviewing.session.id}/review`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: reviewing.action,
            ...(reviewing.action === 'approve'
              ? { transactionReference: value }
              : { reason: value }),
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setReviewing(null);
      setValue('');
      load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Typography component="h1" variant="h3">
        ตรวจสอบการชำระเงิน
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 4 }}>
        เทียบยอด ผู้รับ เวลา และเลขอ้างอิงบนสลิปก่อนอนุมัติ
      </Typography>
      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {!!disputes.length && (
        <Card sx={{ p: 3, mb: 3, border: '1px solid', borderColor: 'error.light' }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
            <RiErrorWarningLine size={28} />
            <Box>
              <Typography variant="h5">ข้อพิพาทการชำระเงิน</Typography>
              <Typography variant="body2" color="text.secondary">
                ระบบระงับสิทธิ์และยอดผู้ขายไว้แล้ว กรุณาตรวจหลักฐานก่อนครบกำหนด
              </Typography>
            </Box>
          </Stack>
          <Stack spacing={1.5}>
            {disputes.map((dispute) => (
              <Box key={dispute.id} sx={{ p: 2, borderRadius: 1.5, bgcolor: 'error.lighter' }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Box>
                    <Typography variant="subtitle2">{dispute.stripe_dispute_id}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {dispute.reason || 'ไม่ระบุเหตุผล'}
                      {dispute.evidence_due_by
                        ? ` · ส่งหลักฐานภายใน ${new Date(dispute.evidence_due_by).toLocaleString(
                            'th-TH'
                          )}`
                        : ''}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1">
                      {formatPrice(Number(dispute.amount))}
                    </Typography>
                    <Chip size="small" color="error" label={dispute.status} />
                    <Button
                      size="small"
                      variant="outlined"
                      href={`/api/marketplace/admin/disputes?id=${dispute.id}`}
                      target="_blank"
                    >
                      ดูชุดหลักฐาน
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Card>
      )}
      {loading ? (
        <Box sx={{ py: 10, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : sessions.length ? (
        <Stack spacing={2}>
          {sessions.map((session) => (
            <Card key={session.id} sx={{ p: 3 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                <Box
                  component="img"
                  src={session.slipUrl || ''}
                  alt="Payment slip"
                  sx={{
                    width: 180,
                    height: 240,
                    objectFit: 'contain',
                    bgcolor: 'grey.100',
                    borderRadius: 2,
                  }}
                />
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h5">{formatPrice(Number(session.amount))}</Typography>
                    <Chip size="small" color="warning" label="รอตรวจสอบ" />
                  </Stack>
                  <Typography color="text.secondary">
                    #{session.id.slice(0, 8).toUpperCase()} · ผู้ซื้อ {session.buyer_id}
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Stack spacing={0.5}>
                    {session.orders?.map((order) => (
                      <Typography key={order.id} variant="body2">
                        {order.seller?.display_name || 'ร้านค้า'} —{' '}
                        {formatPrice(Number(order.total))}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
                <Stack justifyContent="center" spacing={1}>
                  <Button
                    color="error"
                    variant="outlined"
                    startIcon={<RiCloseLine />}
                    onClick={() => {
                      setReviewing({ session, action: 'reject' });
                      setValue('');
                    }}
                  >
                    ไม่อนุมัติ
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<RiCheckboxCircleLine />}
                    onClick={() => {
                      setReviewing({ session, action: 'approve' });
                      setValue('');
                    }}
                  >
                    อนุมัติสลิป
                  </Button>
                </Stack>
              </Stack>
            </Card>
          ))}
        </Stack>
      ) : (
        <Card sx={{ py: 9, textAlign: 'center' }}>
          <RiCheckboxCircleLine size={48} />
          <Typography variant="h5" sx={{ mt: 2 }}>
            ไม่มีสลิปรอตรวจสอบ
          </Typography>
        </Card>
      )}

      <Dialog open={Boolean(reviewing)} onClose={() => setReviewing(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {reviewing?.action === 'approve' ? 'ยืนยันสลิป' : 'ไม่อนุมัติสลิป'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline={reviewing?.action === 'reject'}
            minRows={reviewing?.action === 'reject' ? 3 : undefined}
            label={reviewing?.action === 'approve' ? 'เลขอ้างอิงจากสลิป' : 'เหตุผล'}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setReviewing(null)}>
            ยกเลิก
          </Button>
          <Button
            color={reviewing?.action === 'approve' ? 'primary' : 'error'}
            variant="contained"
            loading={saving}
            disabled={value.trim().length < 3}
            onClick={submit}
          >
            ยืนยัน
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
