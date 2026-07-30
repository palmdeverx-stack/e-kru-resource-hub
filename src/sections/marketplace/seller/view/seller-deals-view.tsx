'use client';

import type { MarketplaceProduct } from '../../shared/types';

import * as z from 'zod';
import dayjs from 'dayjs';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { Form, Field } from 'src/components/hook-form';
import {
  RiAddLine,
  RiSendPlaneLine,
  RiFilePaper2Line,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

import { getProducts, formatPrice } from '../../shared/api';
import { MARKETPLACE_MINIMUM_PAID_PRICE_THB } from '../../shared/payment';

type Deal = {
  id: string;
  public_token: string;
  school_name: string;
  contact_name: string;
  negotiated_price: number;
  expires_at: string;
  status: string;
  product: { id: string; title: string } | null;
};

const statusLabels: Record<
  string,
  { label: string; color: 'default' | 'info' | 'success' | 'warning' }
> = {
  draft: { label: 'แบบร่าง', color: 'default' },
  sent: { label: 'ส่งแล้ว', color: 'info' },
  viewed: { label: 'เปิดดูแล้ว', color: 'info' },
  accepted: { label: 'ยอมรับแล้ว', color: 'success' },
  awaiting_payment: { label: 'รอชำระเงิน', color: 'warning' },
  paid: { label: 'ชำระแล้ว', color: 'success' },
  active: { label: 'เปิดใช้งานแล้ว', color: 'success' },
  expired: { label: 'หมดอายุ', color: 'default' },
  cancelled: { label: 'ยกเลิก', color: 'default' },
};

const initialForm = {
  productId: '',
  schoolName: '',
  schoolCode: '',
  schoolEmail: '',
  contactName: '',
  contactPosition: '',
  contactPhone: '',
  negotiatedPrice: '',
  expiresAt: '',
  terms: '',
};

const DealSchema = z.object({
  productId: z.string().min(1, { error: 'กรุณาเลือกสินค้า' }),
  schoolName: z.string().trim().min(2, { error: 'กรุณากรอกชื่อโรงเรียน' }),
  schoolCode: z
    .string()
    .trim()
    .refine((value) => !value || /^\d{8}$/.test(value), {
      error: 'รหัสโรงเรียนต้องเป็นตัวเลข 8 หลัก',
    }),
  schoolEmail: z.email({ error: 'กรุณากรอกอีเมลโรงเรียนให้ถูกต้อง' }),
  contactName: z.string().trim().min(2, { error: 'กรุณากรอกชื่อผู้ติดต่อ' }),
  contactPosition: z.string().trim(),
  contactPhone: z
    .string()
    .trim()
    .refine((value) => !value || /^[\d+\-\s]{9,20}$/.test(value), {
      error: 'กรุณากรอกเบอร์โทรให้ถูกต้อง',
    }),
  negotiatedPrice: z
    .string()
    .min(1, { error: 'กรุณากรอกราคาตามข้อเสนอ' })
    .refine(
      (value) =>
        Number.isFinite(Number(value)) &&
        Number(value) >= MARKETPLACE_MINIMUM_PAID_PRICE_THB,
      {
        error: `ราคาหลังส่วนลดต้องไม่น้อยกว่า ${MARKETPLACE_MINIMUM_PAID_PRICE_THB} บาท`,
      }
    ),
  expiresAt: z
    .string()
    .min(1, { error: 'กรุณาเลือกวันหมดอายุข้อเสนอ' })
    .refine((value) => dayjs(value).isValid() && dayjs(value).isAfter(dayjs(), 'day'), {
      error: 'วันหมดอายุต้องเป็นวันถัดจากวันนี้',
    }),
  terms: z.string().trim().max(2000, { error: 'เงื่อนไขต้องไม่เกิน 2,000 ตัวอักษร' }),
});

type DealSchemaType = z.infer<typeof DealSchema>;

export function SellerDealsView() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const methods = useForm<DealSchemaType>({
    resolver: zodResolver(DealSchema),
    defaultValues: initialForm,
  });
  const {
    reset,
    setValue,
    setError: setFormError,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const load = async () => {
    const [dealResponse, productResult] = await Promise.all([
      fetch('/api/marketplace/seller/deals', { cache: 'no-store' }),
      getProducts({ mine: true }),
    ]);
    const dealResult = await dealResponse.json();
    if (!dealResponse.ok) throw new Error(dealResult.message ?? 'โหลดข้อเสนอไม่สำเร็จ');
    setDeals(dealResult.deals ?? []);
    setProducts(productResult.products.filter((product) => product.status === 'published'));
  };

  useEffect(() => {
    load()
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลไม่สำเร็จ')
      )
      .finally(() => setLoading(false));
  }, []);

  const createDeal = handleSubmit(async (data) => {
    setError('');
    const selectedProduct = products.find((product) => product.id === data.productId);

    if (selectedProduct && Number(data.negotiatedPrice) > Number(selectedProduct.price)) {
      setFormError('negotiatedPrice', {
        message: 'ราคาตามข้อเสนอต้องไม่สูงกว่าราคาสินค้า',
      });
      return;
    }

    if (
      selectedProduct?.resource_type === 'feature_unlock' &&
      selectedProduct.license_scope !== 'individual' &&
      !/^\d{8}$/.test(data.schoolCode)
    ) {
      setFormError('schoolCode', {
        message: 'แพ็กเกจโรงเรียนต้องระบุรหัสโรงเรียน 8 หลัก',
      });
      return;
    }

    try {
      const response = await fetch('/api/marketplace/seller/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, sendNow: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'สร้างข้อเสนอไม่สำเร็จ');
      const absoluteLink = `${window.location.origin}${result.quotePath}`;
      await navigator.clipboard?.writeText(absoluteLink);
      setMessage(`สร้างข้อเสนอแล้ว ลิงก์ถูกคัดลอก: ${absoluteLink}`);
      setDialogOpen(false);
      reset(initialForm);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'สร้างข้อเสนอไม่สำเร็จ');
    }
  });

  const closeDialog = () => {
    setDialogOpen(false);
    reset(initialForm);
  };

  const copyLink = async (token: string) => {
    const link = `${window.location.origin}/quotes/${token}`;
    await navigator.clipboard?.writeText(link);
    setMessage('คัดลอกลิงก์ข้อเสนอแล้ว');
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: 480, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: { xs: 4, md: 6 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={2}
      >
        <Box>
          <Typography component="h1" variant="h3">
            ข้อเสนอขายโรงเรียน
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            สร้างใบเสนอราคาและส่งลิงก์ให้ผู้มีอำนาจของโรงเรียนยอมรับ
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<RiAddLine />} onClick={() => setDialogOpen(true)}>
          สร้างข้อเสนอ
        </Button>
      </Stack>

      {!!error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}
      {!!message && (
        <Alert severity="success" sx={{ mt: 3 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      <Stack spacing={2} sx={{ mt: 4 }}>
        {deals.length ? (
          deals.map((deal) => {
            const status = statusLabels[deal.status] ?? statusLabels.draft;
            return (
              <Card key={deal.id} variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  spacing={2}
                >
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <RiFilePaper2Line size={22} />
                      <Typography variant="h5">{deal.school_name}</Typography>
                      <Chip size="small" color={status.color} label={status.label} />
                    </Stack>
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                      {deal.product?.title} · ผู้ติดต่อ {deal.contact_name}
                    </Typography>
                    <Typography variant="h5" color="primary.main" sx={{ mt: 1 }}>
                      {formatPrice(Number(deal.negotiated_price))}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                      variant="outlined"
                      startIcon={<RiSendPlaneLine />}
                      onClick={() => copyLink(deal.public_token)}
                    >
                      คัดลอกลิงก์
                    </Button>
                    {deal.status === 'active' && (
                      <Chip
                        icon={<RiCheckboxCircleLine />}
                        color="success"
                        label="License พร้อมใช้"
                      />
                    )}
                  </Stack>
                </Stack>
              </Card>
            );
          })
        ) : (
          <Card variant="outlined" sx={{ py: 10, textAlign: 'center' }}>
            <RiFilePaper2Line size={48} />
            <Typography variant="h5" sx={{ mt: 2 }}>
              ยังไม่มีข้อเสนอขาย
            </Typography>
          </Card>
        )}
      </Stack>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md">
        <Form methods={methods} onSubmit={createDeal}>
          <DialogTitle>สร้างข้อเสนอขายโรงเรียน</DialogTitle>
          <DialogContent>
            <Stack spacing={2.25} sx={{ pt: 1 }}>
              <Field.Select
                name="productId"
                required
                label="สินค้า"
                onChange={(event) => {
                  const product = products.find((item) => item.id === event.target.value);
                  setValue('productId', event.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  setValue('negotiatedPrice', String(product?.price ?? ''), {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
              >
                {products.map((product) => (
                  <MenuItem key={product.id} value={product.id}>
                    {product.title} · {formatPrice(Number(product.price))}
                  </MenuItem>
                ))}
              </Field.Select>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Field.Text name="schoolName" required label="ชื่อโรงเรียน" />
                <Field.Text
                  name="schoolCode"
                  label="รหัสโรงเรียน 8 หลัก"
                  slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 8 } }}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Field.Text name="schoolEmail" required type="email" label="อีเมลโรงเรียน" />
                <Field.Text name="contactName" required label="ชื่อผู้ติดต่อ" />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Field.Text name="contactPosition" label="ตำแหน่ง" />
                <Field.Text name="contactPhone" label="เบอร์โทร" />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Field.Text
                  name="negotiatedPrice"
                  required
                  type="number"
                  label="ราคาตามข้อเสนอ"
                  helperText={`ราคาหลังส่วนลดขั้นต่ำ ${MARKETPLACE_MINIMUM_PAID_PRICE_THB} บาท`}
                  slotProps={{
                    htmlInput: { min: MARKETPLACE_MINIMUM_PAID_PRICE_THB, step: 0.01 },
                  }}
                />
                <Field.DatePicker
                  name="expiresAt"
                  required
                  label="ข้อเสนอหมดอายุ"
                  minDate={dayjs().add(1, 'day')}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Stack>
              <Field.Text
                name="terms"
                multiline
                minRows={4}
                label="เงื่อนไขเพิ่มเติม"
                helperText="ระบุขอบเขตงาน ระยะเวลา License หรือเงื่อนไขการให้บริการเพิ่มเติม"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button color="inherit" onClick={closeDialog}>
              ยกเลิก
            </Button>
            <Button type="submit" variant="contained" loading={isSubmitting}>
              สร้างและคัดลอกลิงก์
            </Button>
          </DialogActions>
        </Form>
      </Dialog>
    </Container>
  );
}
