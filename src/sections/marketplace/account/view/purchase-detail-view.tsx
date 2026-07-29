'use client';

import type { MarketplaceOrder } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
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
  RiBankCardLine,
  RiFileTextLine,
  RiArrowLeftLine,
  RiShieldCheckLine,
  RiShoppingBag3Line,
  RiDownloadCloud2Line,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

import { getMyOrder, formatPrice } from '../../shared/api';
import { MarketplaceSellerLink } from '../../shared/seller-link';

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
  const needsPayment = Boolean(
    order.payment_session_id &&
    ['pending_payment', 'payment_review', 'payment_rejected'].includes(order.status)
  );

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Button
        component={RouterLink}
        href={paths.marketplace.purchases}
        color="inherit"
        startIcon={<RiArrowLeftLine />}
        sx={{ mb: 3 }}
      >
        กลับไปรายการซื้อ
      </Button>

      <Card
        sx={{
          p: { xs: 2.5, md: 4 },
          mb: 3,
          overflow: 'hidden',
          position: 'relative',
          borderRadius: 4,
          color: 'common.white',
          background: isPaid
            ? 'linear-gradient(125deg, #075A47 0%, #0B8F70 58%, #39BFA0 100%)'
            : 'linear-gradient(125deg, #102A56 0%, #1558B0 58%, #2389DD 100%)',
          '&::after': {
            width: 260,
            height: 260,
            content: '""',
            borderRadius: '50%',
            position: 'absolute',
            right: -80,
            bottom: -180,
            bgcolor: 'rgba(255,255,255,0.12)',
          },
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ md: 'center' }}
          spacing={3}
          sx={{ position: 'relative', zIndex: 1 }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{
                width: 58,
                height: 58,
                flexShrink: 0,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'rgba(255,255,255,0.14)',
              }}
            >
              <RiFileTextLine size={29} />
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography component="h1" variant="h3">
                  รายละเอียดการซื้อ
                </Typography>
                <OrderStatusChip status={order.status} />
              </Stack>
              <Typography sx={{ mt: 0.5, color: 'rgba(255,255,255,0.76)' }}>
                ORD-{order.id.slice(0, 12).toUpperCase()} ·{' '}
                {new Date(order.created_at).toLocaleDateString('th-TH', {
                  dateStyle: 'long',
                })}
              </Typography>
            </Box>
          </Stack>
          <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={1}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)' }}>
              ยอดรวมสุทธิ
            </Typography>
            <Typography variant="h2">{formatPrice(Number(order.total), order.currency)}</Typography>
            {needsPayment && (
              <Button
                component={RouterLink}
                href={paths.marketplace.dashboardPayment(order.payment_session_id!)}
                variant="contained"
                color="inherit"
                startIcon={<RiBankCardLine />}
                sx={{
                  mt: 0.5,
                  color: 'primary.darker',
                  bgcolor: 'common.white',
                  '&:hover': { bgcolor: 'grey.100' },
                }}
              >
                {order.status === 'pending_payment'
                  ? 'ไปชำระเงิน'
                  : order.status === 'payment_rejected'
                    ? 'ส่งหลักฐานใหม่'
                    : 'ดูสถานะการตรวจสอบ'}
              </Button>
            )}
          </Stack>
        </Stack>
      </Card>

      {isPaid && (
        <Card variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 3, bgcolor: 'success.lighter' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                flexShrink: 0,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                color: 'success.main',
                bgcolor: 'background.paper',
              }}
            >
              <RiShieldCheckLine size={24} />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle1" color="success.darker">
                ชำระเงินเรียบร้อยและได้รับสิทธิ์แล้ว
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ดาวน์โหลดไฟล์หรือจัดการ License ของสินค้าที่ซื้อได้จากรายการด้านล่าง
              </Typography>
            </Box>
            <Chip
              color="success"
              variant="soft"
              icon={<RiCheckboxCircleLine />}
              label="พร้อมใช้งาน"
            />
          </Stack>
        </Card>
      )}

      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {!!payment?.rejection_reason && (
        <Alert
          severity="error"
          action={
            <Button
              component={RouterLink}
              href={paths.marketplace.dashboardPayment(order.payment_session_id!)}
              size="small"
              color="error"
            >
              ส่งใหม่
            </Button>
          }
          sx={{ mb: 3 }}
        >
          การชำระเงินไม่ผ่าน: {payment.rejection_reason}
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
          <Card variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h5">สินค้าที่ซื้อ</Typography>
                <Typography variant="body2" color="text.secondary">
                  รายการและสิทธิ์ที่ได้รับจากคำสั่งซื้อนี้
                </Typography>
              </Box>
              <Chip variant="soft" color="primary" label={`${order.items?.length ?? 0} รายการ`} />
            </Stack>
            <Divider sx={{ my: 2.5 }} />
            <Stack spacing={2}>
              {order.items?.map((item) => {
                const product = item.product;
                const cover =
                  product?.images?.find((image) => image.is_cover)?.url ??
                  product?.images?.[0]?.url ??
                  product?.cover_url ??
                  null;
                return (
                  <Box
                    key={item.id}
                    sx={{
                      p: { xs: 1.5, md: 2 },
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2.5,
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={2}
                      alignItems={{ sm: 'flex-start' }}
                    >
                      <Box
                        sx={{
                          width: { xs: '100%', sm: 176 },
                          aspectRatio: '16 / 10',
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
                          {(isEnglish && product?.title_en) || product?.title || item.title}
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
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          flexWrap="wrap"
                          useFlexGap
                          sx={{ mt: 1.5 }}
                        >
                          <Chip size="small" variant="soft" label={`จำนวน ${item.quantity}`} />
                          <Typography variant="caption" color="text.secondary">
                            {formatPrice(Number(item.unit_price), order.currency)} ต่อรายการ
                          </Typography>
                        </Stack>
                        {product?.resource_type === 'feature_unlock' && isPaid && (
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            alignItems={{ sm: 'center' }}
                            sx={{
                              p: 1.5,
                              mt: 2,
                              borderRadius: 1.5,
                              bgcolor: 'success.lighter',
                            }}
                          >
                            <Chip
                              size="small"
                              color="success"
                              variant="soft"
                              label="สร้าง License แล้ว"
                            />
                            <Button
                              size="small"
                              component={RouterLink}
                              href={
                                product?.license_scope === 'individual'
                                  ? paths.marketplace.personalEntitlements
                                  : paths.marketplace.licenses
                              }
                            >
                              {product?.license_scope === 'individual'
                                ? 'ดูสิทธิ์ของฉัน'
                                : 'จัดการ License'}
                            </Button>
                          </Stack>
                        )}
                        {product?.resource_type === 'digital' && isPaid && (
                          <Box
                            sx={{
                              p: 1.5,
                              mt: 2,
                              borderRadius: 2,
                              bgcolor: 'background.neutral',
                            }}
                          >
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              sx={{ mb: 1.25 }}
                            >
                              <Typography variant="subtitle2">ไฟล์ดาวน์โหลด</Typography>
                              {!!product.files?.length && (
                                <Chip
                                  size="small"
                                  label={`${product.files.length} ไฟล์`}
                                  variant="outlined"
                                />
                              )}
                            </Stack>
                            <Stack spacing={1}>
                              {product.files?.length ? (
                                product.files.map((file) =>
                                  file.url ? (
                                    <Button
                                      key={file.id}
                                      size="small"
                                      variant="contained"
                                      color="inherit"
                                      href={file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      startIcon={<RiDownloadCloud2Line />}
                                      sx={{
                                        justifyContent: 'flex-start',
                                        bgcolor: 'background.paper',
                                        '&:hover': { bgcolor: 'grey.100' },
                                      }}
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
                                  variant="contained"
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
                      <Typography variant="h6" color="primary.main" sx={{ whiteSpace: 'nowrap' }}>
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
          <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <RiBankLine size={22} />
              <Typography variant="h6">สรุปคำสั่งซื้อ</Typography>
            </Stack>
            <Divider sx={{ my: 2.5 }} />
            <Stack spacing={1.75}>
              <InfoRow
                label="เลขที่คำสั่งซื้อ"
                value={`ORD-${order.id.slice(0, 8).toUpperCase()}`}
              />
              <InfoRow
                label="วันที่สั่งซื้อ"
                value={new Date(order.created_at).toLocaleString('th-TH', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              />
              <InfoRow label="จำนวนสินค้า" value={`${order.items?.length ?? 0} รายการ`} />
              <InfoRow label="สถานะคำสั่งซื้อ" value={statusLabel(order.status)} />
              <Divider />
              <InfoRow
                label="ช่องทางชำระ"
                value={
                  payment?.payment_method === 'stripe'
                    ? 'บัตร/Stripe'
                    : payment?.payment_method === 'free'
                      ? 'สินค้าราคา 0 บาท'
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
              {needsPayment && (
                <Button
                  component={RouterLink}
                  href={paths.marketplace.dashboardPayment(order.payment_session_id!)}
                  fullWidth
                  variant="contained"
                  startIcon={<RiBankCardLine />}
                >
                  {order.status === 'pending_payment'
                    ? 'ไปชำระเงิน'
                    : order.status === 'payment_rejected'
                      ? 'ส่งหลักฐานใหม่'
                      : 'ดูสถานะการตรวจสอบ'}
                </Button>
              )}
            </Stack>
          </Card>

          <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <RiStore2Line size={22} />
              <Box>
                <Typography variant="h6">ข้อมูลร้านค้า</Typography>
                <Typography variant="caption" color="text.secondary">
                  คลิกชื่อร้านเพื่อดูสินค้าอื่น
                </Typography>
              </Box>
            </Stack>
            <Divider sx={{ my: 2 }} />
            <MarketplaceSellerLink
              seller={order.seller}
              avatarSize={44}
              nameVariant="subtitle2"
              fallbackName="ร้านค้า eKru"
            />
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
    return (
      <Chip
        color="success"
        label="พร้อมใช้งาน"
        variant="soft"
        sx={{ bgcolor: 'background.paper' }}
      />
    );
  }
  if (status === 'payment_review') {
    return (
      <Chip
        color="warning"
        label="รอตรวจสลิป"
        variant="soft"
        sx={{ bgcolor: 'background.paper' }}
      />
    );
  }
  if (status === 'payment_rejected') {
    return (
      <Chip color="error" label="สลิปไม่ผ่าน" variant="soft" sx={{ bgcolor: 'background.paper' }} />
    );
  }
  if (status === 'refunded') {
    return <Chip label="คืนเงินแล้ว" variant="soft" sx={{ bgcolor: 'background.paper' }} />;
  }
  if (status === 'cancelled') {
    return <Chip label="ยกเลิก" variant="soft" sx={{ bgcolor: 'background.paper' }} />;
  }
  return (
    <Chip color="info" label="รอชำระเงิน" variant="soft" sx={{ bgcolor: 'background.paper' }} />
  );
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
