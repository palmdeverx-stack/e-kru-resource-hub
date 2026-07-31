'use client';

import type { MarketplaceFinanceSettings } from '../../shared/types';

import { useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

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

export function MarketplaceFinanceSettingsView() {
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/marketplace/admin/finance-settings')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        setForm(result.settings);
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Typography component="h1" variant="h3">
        ตั้งค่าการเงิน Marketplace
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 4 }}>
        บัญชีรับเงิน ค่าธรรมเนียม ระยะพักยอด และเงื่อนไขการโอนให้ผู้ขาย
      </Typography>
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

      <Card sx={{ p: { xs: 2.5, md: 4 } }}>
        <Stack spacing={3}>
          <FormControlLabel
            control={
              <Switch
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              />
            }
            label="เปิดรับชำระผ่าน QR PromptPay"
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.stripeEnabled}
                disabled={!form.stripeConfigured}
                onChange={(event) => setForm({ ...form, stripeEnabled: event.target.checked })}
              />
            }
            label="เปิดรับชำระผ่าน Stripe Checkout"
          />
          <Alert severity={form.stripeConfigured ? 'success' : 'warning'}>
            {form.stripeConfigured
              ? 'พบ Stripe Secret Key และ Webhook Secret แล้ว'
              : 'ตั้งค่า STRIPE_SECRET_KEY และ STRIPE_WEBHOOK_SECRET บน Server ก่อนเปิด Stripe'}
          </Alert>
          <TextField
            label="Stripe Webhook endpoint"
            value={form.stripeWebhookUrl}
            slotProps={{ input: { readOnly: true } }}
            helperText={
              localWebhookTarget
                ? 'URL localhost ใช้กับ Stripe Workbench ไม่ได้ ให้เปิด Stripe CLI ตามคำสั่งด้านล่าง'
                : 'เพิ่ม URL นี้ใน Stripe Workbench และเลือก Checkout, Payment Intent และ Refund events ที่ระบบกำหนด'
            }
          />
          <Typography variant="caption" color="text.secondary">
            Webhook ต้องเปิด Checkout, Payment Intent, Refund และ Charge Dispute events
            เพื่อให้ระบบระงับสิทธิ์และเก็บหลักฐาน Chargeback อัตโนมัติ
          </Typography>
          {localWebhookTarget && (
            <Alert severity="info">
              <Typography variant="body2">
                สำหรับการทดสอบบนเครื่อง ให้เปิด Terminal และรันคำสั่งนี้ค้างไว้:
              </Typography>
              <Typography
                component="code"
                variant="body2"
                sx={{ display: 'block', mt: 1, wordBreak: 'break-all' }}
              >
                stripe listen --forward-to {localWebhookTarget}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                นำค่า whsec_... ที่ Stripe CLI แสดงไปใส่ใน STRIPE_WEBHOOK_SECRET แล้ว restart server
              </Typography>
            </Alert>
          )}
          <TextField
            label="PromptPay ID"
            value={form.promptpayId}
            onChange={(event) => setForm({ ...form, promptpayId: event.target.value })}
            helperText="เบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน/เลขภาษี 13 หลัก"
          />
          <TextField
            label="ชื่อบัญชีรับเงิน"
            value={form.promptpayAccountName}
            onChange={(event) => setForm({ ...form, promptpayAccountName: event.target.value })}
          />
          <Card variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
            <Typography variant="h6">บัญชีต้นทางสำหรับโอนให้ผู้ขาย</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
              ใช้แสดงให้เจ้าหน้าที่ตรวจสอบก่อนเปิด K BIZ ระบบไม่จัดเก็บรหัสผ่านหรือ OTP
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
                label="เลขบัญชีต้นทาง"
                value={form.payoutAccountNumber}
                onChange={(event) =>
                  setForm({ ...form, payoutAccountNumber: event.target.value.replace(/\D/g, '') })
                }
                slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 20 } }}
              />
              <TextField
                label="ชื่อบัญชีต้นทาง"
                value={form.payoutAccountName}
                onChange={(event) => setForm({ ...form, payoutAccountName: event.target.value })}
              />
            </Stack>
          </Card>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              type="number"
              label="ค่าธรรมเนียม Default ทุกร้าน (%)"
              value={form.commissionRate}
              onChange={(event) => setForm({ ...form, commissionRate: Number(event.target.value) })}
              helperText="ใช้กับร้านที่ไม่ได้กำหนดค่าเฉพาะ ร้านทางการ eKru คิด 0% อัตโนมัติ"
            />
            <TextField
              fullWidth
              type="number"
              label="พักยอด (วัน)"
              value={form.holdDays}
              onChange={(event) => setForm({ ...form, holdDays: Number(event.target.value) })}
              helperText="เริ่มนับหลังอนุมัติสลิป"
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              fullWidth
              label="วันทำรอบโอน"
              value={form.payoutDay}
              onChange={(event) => setForm({ ...form, payoutDay: Number(event.target.value) })}
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
              value={form.minimumPayout}
              onChange={(event) => setForm({ ...form, minimumPayout: Number(event.target.value) })}
            />
          </Stack>
          <Alert severity="info">
            ระบบนี้ตรวจสลิปและโอนเงินด้วยผู้ดูแล ยังไม่มีการยืนยันยอดอัตโนมัติจากธนาคาร
          </Alert>
          <Button variant="contained" size="large" loading={saving} onClick={save}>
            บันทึกการตั้งค่า
          </Button>
        </Stack>
      </Card>
    </Container>
  );
}
