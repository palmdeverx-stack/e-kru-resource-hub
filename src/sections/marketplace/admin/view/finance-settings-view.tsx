'use client';

import type { MarketplaceFinanceSettings } from '../../shared/types';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { RiEyeLine, RiEyeOffLine } from 'src/components/remix-icon';

import { ThaiBankAutocomplete } from '../../shared/bank-autocomplete';

const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

function getLocalWebhookTarget(value: string) {
  try {
    const url = new URL(value);
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) return null;
    return `${url.host}${url.pathname}`;
  } catch {
    return null;
  }
}

const initial: MarketplaceFinanceSettings = {
  promptpayId: '',
  promptpayAccountName: '',
  payoutBankName: '',
  payoutBankCode: '',
  payoutAccountNumber: '',
  payoutAccountName: '',
  commissionRate: 10,
  holdDays: 7,
  payoutDay: 5,
  minimumPayout: 100,
  stripeEnabled: false,
  stripeConfigured: false,
  stripeWebhookUrl: '',
  isActive: false,
};

type NumericField = 'commissionRate' | 'holdDays' | 'minimumPayout';

type StripePayout = {
  id: string;
  amount: number;
  currency: string;
  arrivalDate: string;
  createdAt: string;
  status: string;
  automatic: boolean;
  failureMessage: string | null;
};

type StripePayoutSummary = {
  configured: boolean;
  availableAmount: number;
  pendingAmount: number;
  currency: string;
  payouts: StripePayout[];
  account?: {
    id: string;
    businessName: string | null;
    country: string | null;
    liveMode: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    requirementsDueCount: number;
    requirementsDeadline: string | null;
  };
  bankAccount?: {
    bankName: string | null;
    last4: string;
    accountHolderName: string | null;
  } | null;
  schedule?: {
    interval: string | null;
    weeklyPayoutDays: string[];
    monthlyPayoutDays: number[];
    settlementDelayDays: number | null;
    status: string | null;
  };
  lastPaidPayout?: StripePayout | null;
  failedPayouts?: StripePayout[];
  updatedAt?: string;
};

const initialNumericDrafts: Record<NumericField, string> = {
  commissionRate: String(initial.commissionRate),
  holdDays: String(initial.holdDays),
  minimumPayout: String(initial.minimumPayout),
};

type Props = {
  accessGranted?: boolean;
  onAccessExpired?: () => void;
};

export function MarketplaceFinanceSettingsView({
  accessGranted = true,
  onAccessExpired,
}: Props) {
  const [form, setForm] = useState(initial);
  const [numericDrafts, setNumericDrafts] = useState(initialNumericDrafts);
  const [showPayoutAccountNumber, setShowPayoutAccountNumber] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [stripeSummary, setStripeSummary] = useState<StripePayoutSummary | null>(null);
  const [stripeSummaryLoading, setStripeSummaryLoading] = useState(true);
  const [stripeSummaryError, setStripeSummaryError] = useState('');

  const loadStripeSummary = useCallback(async () => {
    if (!accessGranted) {
      setStripeSummaryLoading(true);
      return;
    }
    setStripeSummaryLoading(true);
    setStripeSummaryError('');
    try {
      const response = await fetch('/api/marketplace/admin/stripe-payout-summary', {
        cache: 'no-store',
      });
      const result = await response.json();
      if (response.status === 401) onAccessExpired?.();
      if (!response.ok) throw new Error(result.message);
      setStripeSummary(result);
    } catch (loadError) {
      setStripeSummaryError(
        loadError instanceof Error ? loadError.message : 'ดึงข้อมูลจาก Stripe ไม่สำเร็จ'
      );
    } finally {
      setStripeSummaryLoading(false);
    }
  }, [accessGranted, onAccessExpired]);

  useEffect(() => {
    if (!accessGranted) {
      setLoading(true);
      return;
    }
    fetch('/api/marketplace/admin/finance-settings')
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) onAccessExpired?.();
        if (!response.ok) throw new Error(result.message);
        setForm(result.settings);
        setNumericDrafts({
          commissionRate: String(result.settings.commissionRate),
          holdDays: String(result.settings.holdDays),
          minimumPayout: String(result.settings.minimumPayout),
        });
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));

    loadStripeSummary();
  }, [accessGranted, loadStripeSummary, onAccessExpired]);

  const updateNumericField = (field: NumericField, rawValue: string) => {
    const normalized = rawValue.replace(/^0+(?=\d)/, '');
    const parsed = Number(normalized);
    const value = normalized && Number.isFinite(parsed) ? parsed : 0;
    setNumericDrafts((current) => ({ ...current, [field]: normalized }));
    setForm((current) => ({ ...current, [field]: value }));
  };

  const commitNumericField = (field: NumericField, rawValue: string) => {
    const parsed = Number(rawValue);
    const value = Number.isFinite(parsed) ? parsed : 0;
    setNumericDrafts((current) => ({ ...current, [field]: String(value) }));
    setForm((current) => ({ ...current, [field]: value }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/marketplace/admin/finance-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (response.status === 401) onAccessExpired?.();
      if (!response.ok) throw new Error(result.message);
      setMessage('บันทึกการตั้งค่าการเงินแล้ว');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CircularProgress sx={{ m: 6 }} />;

  const localWebhookTarget = getLocalWebhookTarget(form.stripeWebhookUrl);
  const formatStripeAmount = (amount: number, currency = 'thb') =>
    new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amount / 100);
  const formatArrivalDate = (value: string) =>
    new Intl.DateTimeFormat('th-TH', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  const payoutScheduleLabel = (() => {
    const schedule = stripeSummary?.schedule;
    if (!schedule?.interval) return 'ยังไม่มีข้อมูล';
    if (schedule.interval === 'daily') return 'โอนอัตโนมัติทุกวัน';
    if (schedule.interval === 'manual') return 'โอนเมื่อสั่งด้วยตนเอง';
    if (schedule.interval === 'weekly') {
      const thaiDays: Record<string, string> = {
        monday: 'จันทร์',
        tuesday: 'อังคาร',
        wednesday: 'พุธ',
        thursday: 'พฤหัสบดี',
        friday: 'ศุกร์',
      };
      return `ทุกวัน${schedule.weeklyPayoutDays.map((day) => thaiDays[day] ?? day).join(', ')}`;
    }
    return `ทุกวันที่ ${schedule.monthlyPayoutDays.join(', ')} ของเดือน`;
  })();

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            ตั้งค่าการเงิน Marketplace
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            จัดการช่องทางรับเงิน บัญชีกลาง ค่าธรรมเนียม และรอบโอนให้ผู้ขาย
          </Typography>
        </Box>
        <Button variant="contained" size="large" loading={saving} onClick={save}>
          บันทึกการตั้งค่า
        </Button>
      </Stack>
      {!!error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {!!message && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}

      <Stack spacing={3}>
        <Card sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Typography variant="h5">1. ช่องทางรับชำระเงิน</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
            เปิด–ปิดช่องทางชำระ และตรวจสอบข้อมูลรับเงินของแพลตฟอร์ม
          </Typography>

          <Box
            sx={{
              gap: 2.5,
              display: 'grid',
              alignItems: 'start',
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            }}
          >
            <Card
              variant="outlined"
              sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5, height: '100%' }}
            >
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6">QR PromptPay</Typography>
                  <Typography variant="body2" color="text.secondary">
                    รับชำระเข้าบัญชีของแพลตฟอร์มและตรวจสลิปโดยผู้ดูแล
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.isActive}
                      onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                    />
                  }
                  label={form.isActive ? 'เปิดรับชำระแล้ว' : 'ปิดรับชำระอยู่'}
                />
                <TextField
                  fullWidth
                  label="PromptPay ID"
                  value={form.promptpayId}
                  onChange={(event) => setForm({ ...form, promptpayId: event.target.value })}
                  helperText="เบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน/เลขภาษี 13 หลัก"
                />
                <TextField
                  fullWidth
                  label="ชื่อบัญชีรับเงิน"
                  value={form.promptpayAccountName}
                  onChange={(event) =>
                    setForm({ ...form, promptpayAccountName: event.target.value })
                  }
                />
              </Stack>
            </Card>

            <Card variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6">Stripe Checkout</Typography>
                  <Typography variant="body2" color="text.secondary">
                    รับบัตรผ่าน Stripe และยืนยันผลการชำระด้วย Webhook
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.stripeEnabled}
                      disabled={!form.stripeConfigured}
                      onChange={(event) =>
                        setForm({ ...form, stripeEnabled: event.target.checked })
                      }
                    />
                  }
                  label={form.stripeEnabled ? 'เปิดรับชำระแล้ว' : 'ปิดรับชำระอยู่'}
                />
                <Alert severity={form.stripeConfigured ? 'success' : 'warning'}>
                  {form.stripeConfigured
                    ? 'เชื่อมต่อ Secret Key และ Webhook Secret แล้ว'
                    : 'ตั้งค่า STRIPE_SECRET_KEY และ STRIPE_WEBHOOK_SECRET บน Server ก่อนเปิดใช้'}
                </Alert>
                <TextField
                  fullWidth
                  label="Stripe Webhook endpoint"
                  value={form.stripeWebhookUrl}
                  slotProps={{ input: { readOnly: true } }}
                  helperText={
                    localWebhookTarget
                      ? 'localhost ต้องใช้ Stripe CLI ตามคำสั่งด้านล่าง'
                      : 'เพิ่ม URL นี้ใน Stripe Workbench สำหรับ Payment และ Refund events'
                  }
                />
                <Typography variant="caption" color="text.secondary">
                  เปิด Checkout, Payment Intent, Refund และ Charge Dispute events
                </Typography>
                {/* {localWebhookTarget && (
                  <Alert severity="info">
                    <Typography variant="body2">เปิด Terminal แล้วรันคำสั่งนี้ค้างไว้:</Typography>
                    <Typography
                      component="code"
                      variant="body2"
                      sx={{ display: 'block', mt: 1, wordBreak: 'break-all' }}
                    >
                      stripe listen --forward-to {localWebhookTarget}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                      นำ whsec_... ไปใส่ STRIPE_WEBHOOK_SECRET แล้ว restart server
                    </Typography>
                  </Alert>
                )} */}
              </Stack>
            </Card>
          </Box>
        </Card>

        <Card
          sx={{
            p: { xs: 2.5, md: 3.5 },
            border: '1px solid',
            borderColor: 'info.light',
            bgcolor: 'info.lighter',
          }}
        >
          <Typography variant="h5">2. ภาพรวม Stripe สำหรับผู้ดูแล</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            ตรวจสถานะบัญชี ยอดเงิน รอบโอน และวันเงินเข้าธนาคารได้จากหน้านี้
          </Typography>

          <Card
            variant="outlined"
            sx={{ mt: 2.5, p: { xs: 2, md: 2.5 }, borderRadius: 2.5, bgcolor: 'background.paper' }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ sm: 'center' }}
              justifyContent="space-between"
              spacing={1.5}
            >
              <Box>
                <Typography variant="h6">ข้อมูลสำคัญจาก Stripe</Typography>
                <Typography variant="body2" color="text.secondary">
                  ข้อมูลสดจากบัญชี Stripe สำหรับตรวจสอบงานประจำวัน
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                disabled={stripeSummaryLoading}
                onClick={loadStripeSummary}
              >
                {stripeSummaryLoading ? 'กำลังอัปเดต…' : 'อัปเดตข้อมูล'}
              </Button>
            </Stack>

            {stripeSummaryLoading && !stripeSummary ? (
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 4 }}>
                <CircularProgress size={22} />
                <Typography color="text.secondary">กำลังตรวจสอบรายการโอนจาก Stripe…</Typography>
              </Stack>
            ) : stripeSummaryError ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                {stripeSummaryError}
              </Alert>
            ) : !stripeSummary?.configured ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                ยังไม่ได้ตั้งค่า Stripe Secret Key จึงไม่สามารถแสดงวันและยอดเงินเข้าได้
              </Alert>
            ) : (
              <Stack spacing={2} sx={{ mt: 2 }}>
                {stripeSummary.account && (
                  <>
                    <Box
                      sx={{
                        gap: 1.5,
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '1fr',
                          sm: 'repeat(2, minmax(0, 1fr))',
                          lg: 'repeat(4, minmax(0, 1fr))',
                        },
                      }}
                    >
                      <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                        <Typography variant="caption" color="text.secondary">
                          สถานะระบบรับเงิน
                        </Typography>
                        <Typography
                          variant="subtitle1"
                          color={stripeSummary.account.chargesEnabled ? 'success.dark' : 'error.main'}
                        >
                          {stripeSummary.account.chargesEnabled ? 'พร้อมรับชำระ' : 'รับชำระไม่ได้'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {stripeSummary.account.liveMode ? 'บัญชีจริง (Live)' : 'บัญชีทดสอบ (Test)'}
                        </Typography>
                      </Box>
                      <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                        <Typography variant="caption" color="text.secondary">
                          สถานะการโอนเข้าธนาคาร
                        </Typography>
                        <Typography
                          variant="subtitle1"
                          color={stripeSummary.account.payoutsEnabled ? 'success.dark' : 'error.main'}
                        >
                          {stripeSummary.account.payoutsEnabled ? 'เปิดใช้งานแล้ว' : 'ถูกระงับ/ยังไม่พร้อม'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {stripeSummary.account.businessName ?? `บัญชี ${stripeSummary.account.id}`}
                        </Typography>
                      </Box>
                      <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                        <Typography variant="caption" color="text.secondary">
                          บัญชีธนาคารปลายทาง
                        </Typography>
                        <Typography variant="subtitle1">
                          {stripeSummary.bankAccount
                            ? `${stripeSummary.bankAccount.bankName ?? 'ธนาคาร'} •••• ${stripeSummary.bankAccount.last4}`
                            : 'ยังไม่พบข้อมูล'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {stripeSummary.bankAccount?.accountHolderName ?? 'จะแสดงหลัง Stripe สร้างรายการโอน'}
                        </Typography>
                      </Box>
                      <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                        <Typography variant="caption" color="text.secondary">
                          รอบโอนและระยะเคลียร์ยอด
                        </Typography>
                        <Typography variant="subtitle1">{payoutScheduleLabel}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          เคลียร์ยอดประมาณ {stripeSummary.schedule?.settlementDelayDays ?? '-'} วัน
                        </Typography>
                      </Box>
                    </Box>

                    {(!stripeSummary.account.detailsSubmitted ||
                      !stripeSummary.account.chargesEnabled ||
                      !stripeSummary.account.payoutsEnabled ||
                      stripeSummary.account.requirementsDueCount > 0) && (
                      <Alert severity="error">
                        <Typography variant="subtitle2">บัญชี Stripe ต้องดำเนินการเพิ่มเติม</Typography>
                        <Typography variant="body2">
                          {stripeSummary.account.requirementsDueCount > 0
                            ? `มีข้อมูลหรือเอกสารที่ต้องส่ง ${stripeSummary.account.requirementsDueCount} รายการ`
                            : 'ข้อมูลบัญชียังไม่สมบูรณ์ หรือการรับ/โอนเงินยังไม่พร้อม'}
                          {stripeSummary.account.requirementsDeadline
                            ? ` ภายใน ${formatArrivalDate(stripeSummary.account.requirementsDeadline)}`
                            : ''}
                        </Typography>
                      </Alert>
                    )}
                  </>
                )}

                {(stripeSummary.failedPayouts?.length ?? 0) > 0 && (
                  <Alert severity="error">
                    <Typography variant="subtitle2">พบรายการโอนเข้าธนาคารไม่สำเร็จ</Typography>
                    {stripeSummary.failedPayouts?.map((payout) => (
                      <Typography key={payout.id} variant="body2" sx={{ mt: 0.5 }}>
                        {formatStripeAmount(payout.amount, payout.currency)} ·{' '}
                        {formatArrivalDate(payout.arrivalDate)}
                        {payout.failureMessage ? ` — ${payout.failureMessage}` : ''}
                      </Typography>
                    ))}
                  </Alert>
                )}

                <Typography variant="subtitle1">เงินเข้าบัญชีครั้งถัดไป</Typography>
                {stripeSummary.payouts.length > 0 ? (
                  <Box
                    sx={{
                      gap: 1.5,
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    }}
                  >
                    {stripeSummary.payouts.map((payout) => (
                      <Box
                        key={payout.id}
                        sx={{ p: 2, borderRadius: 2, bgcolor: 'success.lighter' }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          คาดว่าเข้าบัญชี
                        </Typography>
                        <Typography variant="h6" color="success.darker">
                          {formatArrivalDate(payout.arrivalDate)}
                        </Typography>
                        <Typography variant="h4" sx={{ mt: 1 }}>
                          {formatStripeAmount(payout.amount, payout.currency)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {payout.status === 'in_transit'
                            ? 'ธนาคารกำลังดำเนินการ'
                            : 'Stripe เตรียมโอนเข้าธนาคาร'}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Alert severity="info">
                    ยังไม่มีรายการ Payout ที่ Stripe กำหนดวันเข้าบัญชี เมื่อ Stripe สร้างรายการแล้ว
                    หน้านี้จะแสดงวันที่และยอดโดยอัตโนมัติ
                  </Alert>
                )}

                <Box
                  sx={{
                    gap: 1.5,
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      md: 'repeat(3, minmax(0, 1fr))',
                    },
                  }}
                >
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Typography variant="caption" color="text.secondary">
                      พร้อมให้ Stripe โอน
                    </Typography>
                    <Typography variant="subtitle1">
                      {formatStripeAmount(stripeSummary.availableAmount, stripeSummary.currency)}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Typography variant="caption" color="text.secondary">
                      กำลังเคลียร์ยอดใน Stripe
                    </Typography>
                    <Typography variant="subtitle1">
                      {formatStripeAmount(stripeSummary.pendingAmount, stripeSummary.currency)}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Typography variant="caption" color="text.secondary">
                      โอนสำเร็จล่าสุด
                    </Typography>
                    <Typography variant="subtitle1">
                      {stripeSummary.lastPaidPayout
                        ? formatStripeAmount(
                            stripeSummary.lastPaidPayout.amount,
                            stripeSummary.lastPaidPayout.currency
                          )
                        : 'ยังไม่มีรายการ'}
                    </Typography>
                    {stripeSummary.lastPaidPayout && (
                      <Typography variant="caption" color="text.secondary">
                        {formatArrivalDate(stripeSummary.lastPaidPayout.arrivalDate)}
                      </Typography>
                    )}
                  </Box>
                </Box>
                {stripeSummary.updatedAt && (
                  <Typography variant="caption" color="text.secondary">
                    อัปเดตล่าสุด {new Intl.DateTimeFormat('th-TH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(stripeSummary.updatedAt))}
                  </Typography>
                )}
              </Stack>
            )}
          </Card>
          <Box
            sx={{
              gap: 2,
              my: 2.5,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            }}
          >
            {[
              {
                step: '1',
                title: 'ลูกค้าชำระสำเร็จ',
                detail: 'เงินสุทธิหลังหักค่าธรรมเนียมเข้า Stripe Balance สถานะ Pending',
              },
              {
                step: '2',
                title: 'Stripe เคลียร์ยอด',
                detail: 'บัญชีประเทศไทยโดยทั่วไปประมาณ 7 วันทำการ จึงเปลี่ยนเป็น Available',
              },
              {
                step: '3',
                title: 'โอนเข้าธนาคารกลาง',
                detail: 'Stripe โอนตาม Payout schedule; ให้ยึดวันที่ Arrive by ใน Dashboard',
              },
            ].map((item) => (
              <Box
                key={item.step}
                sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', minWidth: 0 }}
              >
                <Typography variant="overline" color="info.main">
                  ขั้นตอน {item.step}
                </Typography>
                <Typography variant="subtitle1">{item.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {item.detail}
                </Typography>
              </Box>
            ))}
          </Box>
          <Alert severity="warning" sx={{ bgcolor: 'background.paper' }}>
            การโอนครั้งแรกอาจช้ากว่าปกติเพราะ Stripe ตรวจสอบบัญชีเพิ่มเติม และวันหยุดจะเลื่อนไป
            วันทำการถัดไป บัญชีปลายทางต้องตั้งใน Stripe Dashboard → Payout settings
            ไม่ใช่บัญชีต้นทาง K BIZ ด้านล่าง
          </Alert>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
            <Button
              component="a"
              href="https://dashboard.stripe.com/balance/overview"
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              color="info"
              variant="contained"
            >
              ดู Balance และวันเงินเข้า
            </Button>
            <Button
              component="a"
              href="https://dashboard.stripe.com/settings/payouts"
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              color="info"
              variant="outlined"
            >
              ตั้งค่าบัญชีและรอบโอน Stripe
            </Button>
          </Stack>
        </Card>

        <Card sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Typography variant="h5">3. การโอนรายได้ให้ผู้ขาย</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
            ตั้งค่าบัญชีที่เจ้าหน้าที่ใช้โอนผ่าน K BIZ และเงื่อนไขที่ใช้คำนวณยอดพร้อมโอน
          </Typography>
          <Box
            sx={{
              gap: 2.5,
              display: 'grid',
              alignItems: 'start',
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            }}
          >
            <Card variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}>
              <Typography variant="h6">บัญชีต้นทาง K BIZ</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                ใช้ตรวจสอบก่อนโอนให้ผู้ขาย ระบบไม่จัดเก็บ User ID, รหัสผ่าน หรือ OTP
              </Typography>
              <Stack spacing={2}>
                <ThaiBankAutocomplete
                  value={form.payoutBankCode || form.payoutBankName}
                  label="ธนาคารต้นทาง"
                  onChange={(bank) =>
                    setForm({
                      ...form,
                      payoutBankCode: bank?.code ?? '',
                      payoutBankName: bank?.name ?? '',
                    })
                  }
                />
                <TextField
                  fullWidth
                  type={showPayoutAccountNumber ? 'text' : 'password'}
                  label="เลขบัญชีต้นทาง"
                  value={form.payoutAccountNumber}
                  onChange={(event) =>
                    setForm({ ...form, payoutAccountNumber: event.target.value.replace(/\D/g, '') })
                  }
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            edge="end"
                            aria-label={showPayoutAccountNumber ? 'ซ่อนเลขบัญชี' : 'แสดงเลขบัญชี'}
                            onClick={() => setShowPayoutAccountNumber((current) => !current)}
                          >
                            {showPayoutAccountNumber ? <RiEyeOffLine /> : <RiEyeLine />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                    htmlInput: { inputMode: 'numeric', maxLength: 20, autoComplete: 'off' },
                  }}
                />
                <TextField
                  fullWidth
                  label="ชื่อบัญชีต้นทาง"
                  value={form.payoutAccountName}
                  onChange={(event) => setForm({ ...form, payoutAccountName: event.target.value })}
                />
              </Stack>
            </Card>

            <Card variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}>
              <Typography variant="h6">นโยบายยอดและรอบโอน</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                มีผลกับร้านทั่วไป ส่วนร้านทางการ E-KRU ใช้ค่าธรรมเนียม 0% อัตโนมัติ
              </Typography>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    fullWidth
                    type="number"
                    label="ค่าธรรมเนียม Default (%)"
                    value={numericDrafts.commissionRate}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => updateNumericField('commissionRate', event.target.value)}
                    onBlur={(event) => commitNumericField('commissionRate', event.target.value)}
                    slotProps={{ htmlInput: { min: 0, max: 100, step: 0.01 } }}
                  />
                  <TextField
                    fullWidth
                    type="number"
                    label="พักยอด (วัน)"
                    value={numericDrafts.holdDays}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => updateNumericField('holdDays', event.target.value)}
                    onBlur={(event) => commitNumericField('holdDays', event.target.value)}
                    slotProps={{ htmlInput: { min: 0, max: 90, step: 1 } }}
                  />
                </Stack>
                <TextField
                  select
                  fullWidth
                  label="วันทำรอบโอน (กำหนดการ)"
                  value={form.payoutDay}
                  onChange={(event) => setForm({ ...form, payoutDay: Number(event.target.value) })}
                  helperText="ใช้แจ้งผู้ขาย ระบบยังไม่สร้างรอบหรือโอนเงินอัตโนมัติ"
                >
                  {DAYS.map((day, index) => (
                    <MenuItem key={day} value={index}>
                      ทุกวัน{day}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  fullWidth
                  type="number"
                  label="ยอดขั้นต่ำสำหรับโอน (บาท)"
                  value={numericDrafts.minimumPayout}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => updateNumericField('minimumPayout', event.target.value)}
                  onBlur={(event) => commitNumericField('minimumPayout', event.target.value)}
                  slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                />
              </Stack>
            </Card>
          </Box>
          <Alert severity="info" sx={{ mt: 2.5 }}>
            <Typography variant="subtitle2">ถึงวันทำรอบแล้วต้องทำอย่างไร?</Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              เลือกร้านที่พ้นระยะพักและถึงยอดขั้นต่ำ → สร้างรอบและ CSV → โอนผ่าน K BIZ →
              กลับมาบันทึกว่าโอนแล้วพร้อมเลขอ้างอิง
            </Typography>
            <Button
              href="/dashboard/payouts"
              size="small"
              color="info"
              variant="outlined"
              sx={{ mt: 1.5 }}
            >
              ไปหน้าโอนเงินให้ผู้ขาย
            </Button>
          </Alert>
        </Card>

        <Stack direction="row" justifyContent="flex-end">
          <Button variant="contained" size="large" loading={saving} onClick={save}>
            บันทึกการตั้งค่าทั้งหมด
          </Button>
        </Stack>
      </Stack>
    </Container>
  );
}
