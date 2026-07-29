'use client';

import type { MarketplaceOrder } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useTranslate } from 'src/locales';

import {
  RiBankLine,
  RiStore2Line,
  RiArrowLeftLine,
  RiShoppingBag3Line,
  RiDownloadCloud2Line,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

import { getMyOrder, formatPrice } from '../../shared/api';

type Props = {
  orderId: string;
};

export function MarketplacePurchaseDetailView({ orderId }: Props) {
  const { currentLang } = useTranslate();
  const isEnglish = currentLang.value === 'en';
  const [order, setOrder] = useState<MarketplaceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyOrder(orderId)
      .then((result) => setOrder(result.order))
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'โหลดรายละเอียดการซื้อไม่สำเร็จ')
      )
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <Box sx={{ minHeight: 500, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!order) {
    return (
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Button
          component={RouterLink}
          href={paths.marketplace.purchases}
          color="inherit"
          startIcon={<RiArrowLeftLine />}
          sx={{ mb: 3 }}
        >
          กลับไปรายการซื้อ
        </Button>
        <Alert severity="error">{error || 'ไม่พบรายละเอียดการซื้อ'}</Alert>
      </Container>
    );
  }

  const isPaid = ['paid', 'completed'].includes(order.status);
  const payment = order.payment_session;

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Button
        component={RouterLink}
        href={paths.marketplace.purchases}
        color="inherit"
        startIcon={<RiArrowLeftLine />}
        sx={{ mb: 3 }}
      >
        กลับไปรายการซื้อ
      </Button>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ md: 'center' }}
        spacing={2}
        sx={{ mb: 4 }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Typography component="h1" variant="h3">
              รายละเอียดการซื้อ
            </Typography>
            <OrderStatusChip status={order.status} />
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            คำสั่งซื้อ #{order.id.toUpperCase()}
          </Typography>
        </Box>
        {order.payment_session_id &&
          ['pending_payment', 'payment_review', 'payment_rejected'].includes(order.status) && (
            <Button
              component={RouterLink}
              href={`/checkout/payment/${order.payment_session_id}`}
              variant="contained"
            >
              {order.status === 'pending_payment' ? 'ไปชำระเงิน' : 'ดูสถานะการตรวจสอบ'}
            </Button>
          )}
      </Stack>

      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {!!payment?.rejection_reason && (
        <Alert severity="error" sx={{ mb: 3 }}>
          การชำระเงินไม่ผ่าน: {payment.rejection_reason}
        </Alert>
      )}
      {isPaid && (
        <Alert severity="success" icon={<RiCheckboxCircleLine />} sx={{ mb: 3 }}>
          ยืนยันการชำระเงินแล้ว สินค้าดิจิทัลพร้อมดาวน์โหลด
        </Alert>
      )}

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 380px' },
        }}
      >
        <Stack spacing={3}>
          <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="h5">สินค้าที่ซื้อ</Typography>
            <Divider sx={{ my: 2.5 }} />
            <Stack divider={<Divider flexItem />} spacing={0}>
              {order.items?.map((item) => {
                const product = item.product;
                const cover =
                  product?.images?.find((image) => image.is_cover)?.url ??
                  product?.images?.[0]?.url ??
                  product?.cover_url ??
                  null;
                return (
                  <Box key={item.id} sx={{ py: 2.5 }}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={2.5}
                      alignItems={{ sm: 'flex-start' }}
                    >
                      <Box
                        sx={{
                          width: { xs: '100%', sm: 150 },
                          aspectRatio: '4 / 3',
                          flexShrink: 0,
                          borderRadius: 2,
                          bgcolor: 'background.neutral',
                          backgroundImage: cover ? `url("${cover}")` : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        {!cover && <RiShoppingBag3Line size={34} />}
                      </Box>
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography variant="h6">
                          {(isEnglish && product?.title_en) || item.title}
                        </Typography>
                        {!!(
                          (isEnglish && product?.short_description_en) ||
                          product?.short_description
                        ) && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {(isEnglish && product?.short_description_en) ||
                              product?.short_description}
                          </Typography>
                        )}
                        <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
                          <Typography variant="body2">จำนวน {item.quantity}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {formatPrice(Number(item.unit_price), order.currency)} ต่อรายการ
                          </Typography>
                        </Stack>
                        {product?.resource_type === 'feature_unlock' && isPaid && (
                          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                            <Chip
                              size="small"
                              color="success"
                              variant="soft"
                              label="สร้าง License แล้ว"
                            />
                            <Button size="small" component={RouterLink} href="/dashboard/licenses">
                              จัดการ License
                            </Button>
                          </Stack>
                        )}
                        {product?.resource_type === 'digital' && isPaid && (
                          <Box sx={{ mt: 2.5 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                              ไฟล์ดาวน์โหลด
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              {product.files?.length ? (
                                product.files.map((file) =>
                                  file.url ? (
                                    <Button
                                      key={file.id}
                                      size="small"
                                      variant="outlined"
                                      href={file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      startIcon={<RiDownloadCloud2Line />}
                                    >
                                      {file.file_name}
                                    </Button>
                                  ) : (
                                    <Button key={file.id} size="small" variant="outlined" disabled>
                                      {file.file_name}
                                    </Button>
                                  )
                                )
                              ) : product.file_url ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  href={product.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  startIcon={<RiDownloadCloud2Line />}
                                >
                                  ดาวน์โหลดสินค้า
                                </Button>
                              ) : (
                                <Alert severity="warning">กำลังเตรียมไฟล์ดาวน์โหลด</Alert>
                              )}
                            </Stack>
                          </Box>
                        )}
                      </Box>
                      <Typography variant="h6">
                        {formatPrice(Number(item.unit_price) * item.quantity, order.currency)}
                      </Typography>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Card>
        </Stack>

        <Stack spacing={3} sx={{ position: { lg: 'sticky' }, top: { lg: 96 } }}>
          <Card variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6">ข้อมูลการซื้อ</Typography>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={2}>
              <InfoRow label="เลขที่คำสั่งซื้อ" value={`#${order.id.slice(0, 12).toUpperCase()}`} />
              <InfoRow
                label="วันที่สั่งซื้อ"
                value={new Date(order.created_at).toLocaleString('th-TH', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              />
              <InfoRow label="จำนวนสินค้า" value={`${order.items?.length ?? 0} รายการ`} />
              <InfoRow label="สถานะ" value={statusLabel(order.status)} />
            </Stack>
          </Card>

          <Card variant="outlined" sx={{ p: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <RiStore2Line size={22} />
              <Typography variant="h6">ร้านค้า</Typography>
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar src={order.seller?.logo_url ?? undefined}>
                <RiStore2Line size={18} />
              </Avatar>
              <Box>
                <Typography variant="subtitle2">
                  {order.seller?.display_name ?? 'ร้านค้า eKru'}
                </Typography>
                {!!order.seller?.slug && (
                  <Button
                    component={RouterLink}
                    href={`/store/${order.seller.slug}`}
                    size="small"
                    sx={{ px: 0 }}
                  >
                    ดูหน้าร้าน
                  </Button>
                )}
              </Box>
            </Stack>
          </Card>

          <Card variant="outlined" sx={{ p: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <RiBankLine size={22} />
              <Typography variant="h6">การชำระเงิน</Typography>
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={2}>
              <InfoRow
                label="ช่องทาง"
                value={
                  payment?.payment_method === 'stripe'
                    ? 'บัตร/Stripe'
                    : payment?.payment_method === 'free'
                      ? 'สินค้าฟรี'
                      : 'PromptPay'
                }
              />
              <InfoRow label="สถานะการชำระ" value={paymentStatusLabel(payment?.status)} />
              {!!payment?.bank_transaction_reference && (
                <InfoRow label="เลขอ้างอิง" value={payment.bank_transaction_reference} />
              )}
              <Divider />
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1">ยอดรวมสุทธิ</Typography>
                <Typography variant="h4" color="primary.main">
                  {formatPrice(Number(order.total), order.currency)}
                </Typography>
              </Stack>
            </Stack>
          </Card>
        </Stack>
      </Box>
    </Container>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} textAlign="right">
        {value}
      </Typography>
    </Stack>
  );
}

function OrderStatusChip({ status }: { status: MarketplaceOrder['status'] }) {
  if (['paid', 'completed'].includes(status)) {
    return <Chip color="success" label="พร้อมใช้งาน" variant="soft" />;
  }
  if (status === 'payment_review') {
    return <Chip color="warning" label="รอตรวจสลิป" variant="soft" />;
  }
  if (status === 'payment_rejected') {
    return <Chip color="error" label="สลิปไม่ผ่าน" variant="soft" />;
  }
  if (status === 'refunded') return <Chip label="คืนเงินแล้ว" variant="soft" />;
  if (status === 'cancelled') return <Chip label="ยกเลิก" variant="soft" />;
  return <Chip color="info" label="รอชำระเงิน" variant="soft" />;
}

function statusLabel(status: MarketplaceOrder['status']) {
  if (['paid', 'completed'].includes(status)) return 'ชำระแล้ว / พร้อมใช้งาน';
  if (status === 'payment_review') return 'รอตรวจสอบสลิป';
  if (status === 'payment_rejected') return 'สลิปไม่ผ่าน';
  if (status === 'refunded') return 'คืนเงินแล้ว';
  if (status === 'cancelled') return 'ยกเลิก';
  return 'รอชำระเงิน';
}

function paymentStatusLabel(
  status?: 'pending_payment' | 'payment_review' | 'verified' | 'rejected' | 'expired'
) {
  if (status === 'verified') return 'ยืนยันแล้ว';
  if (status === 'payment_review') return 'รอตรวจสอบ';
  if (status === 'rejected') return 'ไม่ผ่านการตรวจสอบ';
  if (status === 'expired') return 'หมดอายุ';
  return 'รอชำระเงิน';
}
