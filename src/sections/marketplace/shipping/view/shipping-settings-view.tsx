'use client';

import type { MarketplaceShippingConfig } from '../server/config';

import { useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

type FinanceSummary = {
  collected: number;
  providerCost: number;
  paymentFee: number;
  refunds: number;
  adjustments: number;
  balance: number;
  pendingReconciliation: number;
  differences: number;
  shipmentCount: number;
};

type FinanceShipment = {
  id: string;
  tracking_code?: string | null;
  courier_tracking_code?: string | null;
  courier_name: string;
  shipping_fee: number;
  provider_fee?: number | null;
  payment_fee_allocated: number;
  refunded_amount: number;
  reconciliation_status: string;
  created_at: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value);
}

export function MarketplaceShippingSettingsView({
  initial,
}: {
  initial: MarketplaceShippingConfig;
}) {
  const [settings, setSettings] = useState(initial);
  const [enabled, setEnabled] = useState(initial.requestedEnabled);
  const [environment, setEnvironment] = useState(initial.environment);
  const [saving, setSaving] = useState(false);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [recentShipments, setRecentShipments] = useState<FinanceShipment[]>([]);
  const [actualFees, setActualFees] = useState<Record<string, string>>({});
  const [reconcilingId, setReconcilingId] = useState('');
  const [financeAccessRequired, setFinanceAccessRequired] = useState(false);
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    fetch('/api/marketplace/admin/shipping-settings', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? 'โหลดการตั้งค่าไม่สำเร็จ');
        setSettings(result.settings);
        setEnabled(result.settings.requestedEnabled);
        setEnvironment(result.settings.environment);
        setFinanceSummary(result.financeSummary ?? null);
        setRecentShipments(result.recentShipments ?? []);
        setFinanceAccessRequired(Boolean(result.financeAccessRequired));
      })
      .catch((error) =>
        setMessage({
          severity: 'error',
          text: error instanceof Error ? error.message : 'โหลดการตั้งค่าไม่สำเร็จ',
        })
      );
  }, []);

  const reconcile = async (shipmentId: string) => {
    setReconcilingId(shipmentId);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/marketplace/admin/shipping-finance/${shipmentId}/reconcile`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actualFee: Number(actualFees[shipmentId]) }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'กระทบยอดไม่สำเร็จ');
      const refreshed = await fetch('/api/marketplace/admin/shipping-settings', {
        cache: 'no-store',
      }).then((item) => item.json());
      setFinanceSummary(refreshed.financeSummary ?? null);
      setRecentShipments(refreshed.recentShipments ?? []);
      setMessage({ severity: 'success', text: 'บันทึกค่าขนส่งจริงและกระทบยอดแล้ว' });
    } catch (error) {
      setMessage({
        severity: 'error',
        text: error instanceof Error ? error.message : 'กระทบยอดไม่สำเร็จ',
      });
    } finally {
      setReconcilingId('');
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/marketplace/admin/shipping-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: enabled, environment }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'บันทึกไม่สำเร็จ');
      setSettings(result.settings);
      setEnabled(result.settings.requestedEnabled);
      setMessage({
        severity: 'success',
        text: result.settings.enabled
          ? 'เปิดระบบจัดส่งสำหรับร้านทั่วไปแล้ว'
          : 'ปิดระบบจัดส่งสำหรับร้านทั่วไปแล้ว ร้านทางการยังทดสอบได้',
      });
    } catch (error) {
      setMessage({
        severity: 'error',
        text: error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3, md: 4 } }}>
      <Typography component="h1" variant="h3">
        ตั้งค่าการจัดส่ง
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        สวิตช์นี้ควบคุมการจัดส่งของร้านทั่วไป ส่วนร้านทางการ E-KRU ใช้ Flow ทดสอบได้ตลอด
      </Typography>
      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      {!settings.providerConfigured && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          ตั้งค่า SHIPPOP API, อีเมลบัญชี, Quote Secret และ Webhook Secret ใน Environment Variables
          ให้ครบก่อนเปิดใช้งาน
        </Alert>
      )}
      {settings.officialAccessEnabled && !settings.enabled && (
        <Alert severity="info" sx={{ mb: 2 }}>
          ร้านทางการ E-KRU เข้าไปเตรียมข้อมูลจัดส่งได้แล้ว
          ร้านทั่วไปยังไม่เห็นเมนูหรือสินค้าแบบจัดส่ง
          {!settings.providerConfigured &&
            ' ส่วนการคำนวณราคาและสร้าง Tracking จะพร้อมหลังตั้งค่า SHIPPOP ครบ'}
        </Alert>
      )}
      <Card sx={{ p: 3 }}>
        <Stack spacing={3}>
          <FormControlLabel
            control={
              <Switch checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            }
            label={
              enabled ? 'เปิดใช้งานการจัดส่งสำหรับร้านทั่วไป' : 'ปิดใช้งานการจัดส่งสำหรับร้านทั่วไป'
            }
          />
          <TextField
            select
            label="Environment"
            value={environment}
            onChange={(event) => setEnvironment(event.target.value as 'sandbox' | 'production')}
          >
            <MenuItem value="sandbox">Sandbox / ทดสอบ</MenuItem>
            <MenuItem value="production">Production / ใช้งานจริง</MenuItem>
          </TextField>
          <TextField label="Provider" value="SHIPPOP" slotProps={{ input: { readOnly: true } }} />
          <TextField
            label="Webhook URL"
            value={settings.webhookUrl ?? ''}
            slotProps={{ input: { readOnly: true } }}
          />
          <Button
            variant="contained"
            disabled={saving || (enabled && !settings.providerConfigured)}
            onClick={save}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
          </Button>
        </Stack>
      </Card>
      {financeAccessRequired && (
        <Alert
          severity="info"
          sx={{ mt: 3 }}
          action={
            <Button color="inherit" href="/dashboard/settings/finance">
              ยืนยัน PIN
            </Button>
          }
        >
          ยืนยัน PIN การเงินก่อนดูยอดและกระทบยอดค่าจัดส่ง
        </Alert>
      )}
      {financeSummary && (
        <Card sx={{ p: 3, mt: 3 }}>
          <Typography variant="h5">การเงินค่าจัดส่ง</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            ค่าจัดส่งแยกจากรายได้สินค้าและไม่รวมในการคำนวณคอมมิชชันผู้ขาย
          </Typography>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            flexWrap="wrap"
            useFlexGap
            sx={{ mt: 2 }}
          >
            {[
              ['เก็บจากผู้ซื้อ', financeSummary.collected],
              ['SHIPPOP หัก', -financeSummary.providerCost],
              ['Payment fee', -financeSummary.paymentFee],
              ['คืนผู้ซื้อ', -financeSummary.refunds],
              ['ปรับยอด', financeSummary.adjustments],
              ['คงเหลือสุทธิ', financeSummary.balance],
            ].map(([label, value]) => (
              <Card key={String(label)} variant="outlined" sx={{ p: 2, flex: '1 1 160px' }}>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography variant="h6">{formatMoney(Number(value))}</Typography>
              </Card>
            ))}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Chip
              label={`รอกระทบยอด ${financeSummary.pendingReconciliation}`}
              color="warning"
              variant="soft"
            />
            <Chip label={`มีส่วนต่าง ${financeSummary.differences}`} color="error" variant="soft" />
          </Stack>
        </Card>
      )}
      {!!recentShipments.length && (
        <Card sx={{ p: 3, mt: 3 }}>
          <Typography variant="h5">กระทบยอดล่าสุด</Typography>
          <Stack divider={<Divider flexItem />} sx={{ mt: 1 }}>
            {recentShipments.map((shipment) => (
              <Stack
                key={shipment.id}
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ md: 'center' }}
                justifyContent="space-between"
                sx={{ py: 2 }}
              >
                <Stack sx={{ minWidth: 220 }}>
                  <Typography variant="subtitle2">{shipment.courier_name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {shipment.courier_tracking_code || shipment.tracking_code || shipment.id}
                  </Typography>
                </Stack>
                <Typography variant="body2">
                  เรียกเก็บ {formatMoney(Number(shipment.shipping_fee))}
                </Typography>
                <Chip size="small" label={shipment.reconciliation_status} />
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    type="number"
                    label="SHIPPOP หักจริง"
                    value={actualFees[shipment.id] ?? shipment.provider_fee ?? ''}
                    onChange={(event) =>
                      setActualFees((value) => ({ ...value, [shipment.id]: event.target.value }))
                    }
                    sx={{ width: 150 }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={
                      reconcilingId === shipment.id ||
                      !(Number(actualFees[shipment.id] ?? shipment.provider_fee) >= 0)
                    }
                    onClick={() => reconcile(shipment.id)}
                  >
                    กระทบยอด
                  </Button>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Card>
      )}
    </Container>
  );
}
