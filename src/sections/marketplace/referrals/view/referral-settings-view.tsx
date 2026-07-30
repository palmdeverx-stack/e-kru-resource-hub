'use client';

import { useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

type Settings = {
  isEnabled: boolean;
  rewardRate: number;
  attributionDays: number;
  holdDays: number;
  minimumPayout: number;
  maxRewardPerOrder: number;
  setupRequired?: boolean;
};

const initial: Settings = {
  isEnabled: false,
  rewardRate: 20,
  attributionDays: 30,
  holdDays: 14,
  minimumPayout: 500,
  maxRewardPerOrder: 300,
};

export function MarketplaceReferralSettingsView() {
  const [form, setForm] = useState(initial);
  const [stats, setStats] = useState({ members: 0, rewards: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/marketplace/admin/referral-settings', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        setForm(result.settings);
        setStats(result.stats);
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/marketplace/admin/referral-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setMessage(form.isEnabled ? 'เปิดใช้งานระบบแนะนำเพื่อนแล้ว' : 'ปิดระบบแนะนำเพื่อนแล้ว');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CircularProgress sx={{ m: 6 }} />;

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Typography component="h1" variant="h3">
        ตั้งค่าระบบแนะนำเพื่อน
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.75, mb: 3 }}>
        ควบคุมการเปิดใช้งาน อัตรารางวัล การจดจำ Referral และระยะพักยอด
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
      {form.setupRequired && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          ยังไม่ได้ติดตั้งตาราง Referral กรุณารัน SQL schema ก่อนเปิดใช้งาน
        </Alert>
      )}

      <Card sx={{ p: { xs: 2.5, md: 4 } }}>
        <Stack spacing={3}>
          <FormControlLabel
            control={
              <Switch
                checked={form.isEnabled}
                disabled={form.setupRequired}
                onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })}
              />
            }
            label={form.isEnabled ? 'เปิดใช้งาน Referral อยู่' : 'ปิดใช้งาน Referral อยู่'}
          />
          <Alert severity={form.isEnabled ? 'success' : 'info'}>
            {form.isEnabled
              ? 'ผู้ใช้จะเห็นเมนูแนะนำเพื่อนและระบบเริ่มรับ Referral ใหม่'
              : 'เมนูผู้ใช้จะถูกซ่อนและไม่รับ Referral ใหม่ รางวัลเดิมยังคงอยู่'}
          </Alert>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              type="number"
              label="รางวัลจากค่าธรรมเนียม (%)"
              value={form.rewardRate}
              onChange={(event) => setForm({ ...form, rewardRate: Number(event.target.value) })}
              helperText="ไม่หักเพิ่มจากรายได้ผู้ขาย"
            />
            <TextField
              fullWidth
              type="number"
              label="รางวัลสูงสุดต่อคำสั่งซื้อ"
              value={form.maxRewardPerOrder}
              onChange={(event) =>
                setForm({ ...form, maxRewardPerOrder: Number(event.target.value) })
              }
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              type="number"
              label="จดจำ Referral (วัน)"
              value={form.attributionDays}
              onChange={(event) =>
                setForm({ ...form, attributionDays: Number(event.target.value) })
              }
            />
            <TextField
              fullWidth
              type="number"
              label="พักยอด (วัน)"
              value={form.holdDays}
              onChange={(event) => setForm({ ...form, holdDays: Number(event.target.value) })}
            />
          </Stack>
          <TextField
            type="number"
            label="ยอดขั้นต่ำสำหรับรอบจ่าย"
            value={form.minimumPayout}
            onChange={(event) => setForm({ ...form, minimumPayout: Number(event.target.value) })}
          />
          <Typography variant="body2" color="text.secondary">
            ผู้มี Referral Code {stats.members.toLocaleString('th-TH')} คน · รางวัลทั้งหมด{' '}
            {stats.rewards.toLocaleString('th-TH')} รายการ
          </Typography>
          <Button
            variant="contained"
            size="large"
            loading={saving}
            disabled={form.setupRequired}
            onClick={save}
          >
            บันทึกการตั้งค่า
          </Button>
        </Stack>
      </Card>
    </Container>
  );
}
