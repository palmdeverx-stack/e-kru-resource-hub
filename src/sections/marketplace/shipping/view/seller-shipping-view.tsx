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
import CircularProgress from '@mui/material/CircularProgress';

type Form = {
  contactName: string;
  phone: string;
  address: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
};
type Shipment = {
  id: string;
  status: string;
  tracking_code?: string | null;
  courier_tracking_code?: string | null;
  courier_name: string;
  service_name: string;
  shipping_fee: number;
  receiver_snapshot: { name?: string };
  order?: { id?: string; status?: string } | null;
};
const EMPTY: Form = {
  contactName: '',
  phone: '',
  address: '',
  subdistrict: '',
  district: '',
  province: '',
  postalCode: '',
};

export function SellerShippingView() {
  const [form, setForm] = useState(EMPTY);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/marketplace/seller/shipping', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? 'โหลดข้อมูลไม่สำเร็จ');
    const seller = result.seller ?? {};
    setForm({
      contactName: seller.shipping_contact_name ?? '',
      phone: seller.shipping_phone ?? '',
      address: seller.shipping_address_line ?? '',
      subdistrict: seller.shipping_subdistrict ?? '',
      district: seller.shipping_district ?? '',
      province: seller.shipping_province ?? '',
      postalCode: seller.shipping_postal_code ?? '',
    });
    setShipments(result.shipments ?? []);
  }, []);

  useEffect(() => {
    load()
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMessage('');
    const response = await fetch('/api/marketplace/seller/shipping', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const result = await response.json();
    setSaving(false);
    setMessage(response.ok ? 'บันทึกที่อยู่ต้นทางแล้ว' : (result.message ?? 'บันทึกไม่สำเร็จ'));
  };

  const prepare = async (id: string) => {
    setMessage('');
    const response = await fetch(`/api/marketplace/seller/shipping/${id}/prepare`, {
      method: 'POST',
    });
    const result = await response.json();
    if (!response.ok) setMessage(result.message ?? 'สร้างรายการจัดส่งไม่สำเร็จ');
    else await load();
  };

  if (loading)
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 360 }}>
        <CircularProgress />
      </Box>
    );
  return (
    <Container maxWidth={false} sx={{ py: { xs: 3, md: 4 } }}>
      <Typography component="h1" variant="h3">
        การจัดส่งสินค้า
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        ตั้งค่าต้นทาง เตรียมพัสดุ ดาวน์โหลดใบปะหน้า และติดตามสถานะ
      </Typography>
      {message && (
        <Alert severity={message.includes('แล้ว') ? 'success' : 'info'} sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="flex-start">
        <Card sx={{ p: 3, width: { xs: 1, lg: 440 } }}>
          <Typography variant="h5">ที่อยู่รับพัสดุของร้าน</Typography>
          <Stack spacing={2} sx={{ mt: 2 }}>
            {(
              [
                ['contactName', 'ชื่อผู้ส่ง'],
                ['phone', 'เบอร์โทร'],
                ['address', 'เลขที่ / ถนน'],
                ['subdistrict', 'แขวง / ตำบล'],
                ['district', 'เขต / อำเภอ'],
                ['province', 'จังหวัด'],
                ['postalCode', 'รหัสไปรษณีย์'],
              ] as const
            ).map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                value={form[key]}
                onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.value }))}
              />
            ))}
            <Button variant="contained" disabled={saving} onClick={save}>
              {saving ? 'กำลังบันทึก...' : 'บันทึกที่อยู่ต้นทาง'}
            </Button>
          </Stack>
        </Card>
        <Card sx={{ p: 3, flex: 1, width: 1 }}>
          <Typography variant="h5">พัสดุที่ต้องจัดส่ง</Typography>
          {!shipments.length ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              ยังไม่มีออเดอร์สินค้าจัดส่ง
            </Alert>
          ) : (
            <Stack divider={<Divider flexItem />} sx={{ mt: 1 }}>
              {shipments.map((shipment) => (
                <Stack
                  key={shipment.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  justifyContent="space-between"
                  sx={{ py: 2 }}
                >
                  <Box>
                    <Typography variant="subtitle1">
                      {shipment.receiver_snapshot?.name ?? 'ผู้รับ'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {shipment.courier_name} · {shipment.service_name} · ฿
                      {Number(shipment.shipping_fee).toFixed(2)}
                    </Typography>
                    {(shipment.courier_tracking_code || shipment.tracking_code) && (
                      <Typography variant="body2">
                        Tracking: {shipment.courier_tracking_code || shipment.tracking_code}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={shipment.status} />
                    {shipment.status === 'pending' && shipment.order?.status === 'paid' && (
                      <Button size="small" variant="contained" onClick={() => prepare(shipment.id)}>
                        เตรียมจัดส่ง
                      </Button>
                    )}
                    {shipment.tracking_code && (
                      <Button
                        size="small"
                        variant="outlined"
                        href={`/api/marketplace/shipping/shipments/${shipment.id}/label`}
                        target="_blank"
                      >
                        ใบปะหน้า
                      </Button>
                    )}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </Card>
      </Stack>
    </Container>
  );
}
