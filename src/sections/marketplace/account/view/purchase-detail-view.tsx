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
  const itemQuantity = (order.items ?? []).reduce(
    (total, item) => total + Number(item.quantity),
    0
  );
  const listSubtotal = (order.items ?? []).reduce(
    (total, item) =>
      total +
      Math.max(Number(item.list_unit_price ?? item.unit_price), Number(item.unit_price)) *
        Number(item.quantity),
    0
  );
  const discountTotal = Math.max(
    0,
    Number(order.discount_amount) || listSubtotal - Number(order.total)
  );
  const paidAt = order.paid_at ?? payment?.reviewed_at ?? null;

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
                  timeZone: 'Asia/Bangkok',
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
                const unitPrice = Number(item.unit_price);
                const listUnitPrice = Math.max(
                  Number(item.list_unit_price ?? item.unit_price),
                  unitPrice
                );
                const itemDiscount = Math.max(
                  0,
                  (listUnitPrice - unitPrice) * Number(item.quantity)
                );
                const schoolLicense = order.school_licenses?.find(
                  (license) => license.order_item_id === item.id
                );
                const userLicense = order.user_licenses?.find(
                  (license) => license.order_item_id === item.id
                );
                const license = schoolLicense ?? userLicense;
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
                          {product?.category && (
                            <Chip size="small" variant="outlined" label={product.category} />
                          )}
                          {product?.subject_label && (
                            <Chip size="small" variant="outlined" label={product.subject_label} />
                          )}
                          <Chip
                            size="small"
                            variant="outlined"
                            label={resourceTypeLabel(product?.resource_type)}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {formatPrice(unitPrice, order.currency)} ต่อรายการ
                          </Typography>
                        </Stack>
                        {product?.id && (
                          <Button
                            size="small"
                            component={RouterLink}
                            href={paths.marketplace.product(product.id)}
                            sx={{ mt: 1 }}
                          >
                            ดูหน้าสินค้า
                          </Button>
                        )}
                        {product?.resource_type === 'feature_unlock' &&
                          isPaid &&
                          (license ? (
                            <Box
                              sx={{
                                p: 1.5,
                                mt: 2,
                                borderRadius: 1.5,
                                bgcolor: 'success.lighter',
                              }}
                            >
                              <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={1}
                                alignItems={{ sm: 'center' }}
                              >
                                <Chip
                                  size="small"
                                  color="success"
                                  variant="soft"
                                  label={licenseStatusLabel(license.status)}
                                />
                                <Typography variant="body2">
                                  {schoolLicense?.school?.name
                                    ? `โรงเรียน: ${schoolLicense.school.name}`
                                    : product.license_scope === 'individual'
                                      ? 'สิทธิ์สำหรับบัญชีของฉัน'
                                      : `License ${licenseScopeLabel(product.license_scope)}`}
                                </Typography>
                              </Stack>
                              <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={{ xs: 0.5, sm: 2 }}
                                sx={{ mt: 1 }}
                              >
                                <Typography variant="caption" color="text.secondary">
                                  เริ่ม {formatDateTime(license.starts_at)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  หมดอายุ {formatDateTime(license.expires_at)}
                                </Typography>
                                {'seat_count' in license && license.seat_count > 1 && (
                                  <Typography variant="caption" color="text.secondary">
                                    {license.seat_count} Seats
                                  </Typography>
                                )}
                              </Stack>
                              <Button
                                size="small"
                                component={RouterLink}
                                href={
                                  product.license_scope === 'individual'
                                    ? paths.marketplace.personalEntitlements
                                    : paths.marketplace.licenses
                                }
                                sx={{ mt: 0.5 }}
                              >
                                {product.license_scope === 'individual'
                                  ? 'ดูสิทธิ์ของฉัน'
                                  : 'จัดการ License'}
                              </Button>
                            </Box>
                          ) : (
                            <Alert severity="warning" sx={{ mt: 2 }}>
                              ชำระเงินแล้ว แต่ยังไม่พบข้อมูล License
                              กรุณารีเฟรชหรือติดต่อผู้ดูแลระบบ
                            </Alert>
                          ))}
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
                      <Box sx={{ textAlign: { sm: 'right' }, whiteSpace: 'nowrap' }}>
                        <Typography variant="h6" color="primary.main">
                          {formatPrice(unitPrice * item.quantity, order.currency)}
                        </Typography>
                        {itemDiscount > 0 && (
                          <>
                            <Typography
                              variant="caption"
                              color="text.disabled"
                              sx={{ display: 'block', textDecoration: 'line-through' }}
                            >
                              {formatPrice(listUnitPrice * item.quantity, order.currency)}
                            </Typography>
                            <Typography variant="caption" color="success.main">
                              ประหยัด {formatPrice(itemDiscount, order.currency)}
                            </Typography>
                          </>
                        )}
                      </Box>
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
                value={`ORD-${order.id.slice(0, 12).toUpperCase()}`}
              />
              <InfoRow
                label="วันที่สั่งซื้อ"
                value={new Date(order.created_at).toLocaleString('th-TH', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Asia/Bangkok',
                })}
              />
              <InfoRow
                label="จำนวนสินค้า"
                value={`${itemQuantity} ชิ้น (${order.items?.length ?? 0} รายการ)`}
              />
              <InfoRow label="สถานะคำสั่งซื้อ" value={statusLabel(order.status)} />
              {!!paidAt && <InfoRow label="วันที่ชำระสำเร็จ" value={formatDateTime(paidAt)} />}
              <Divider />
              <InfoRow
                label="ช่องทางชำระ"
                value={
                  payment?.payment_method === 'stripe'
                    ? 'Stripe Checkout'
                    : payment?.payment_method === 'free'
                      ? 'สินค้าราคา 0 บาท'
                      : 'PromptPay'
                }
              />
              <InfoRow label="สถานะการชำระ" value={paymentStatusLabel(payment?.status)} />
              {!!payment?.bank_transaction_reference && (
                <InfoRow label="เลขอ้างอิง" value={payment.bank_transaction_reference} />
              )}
              {!!payment?.submitted_at && (
                <InfoRow label="ส่งข้อมูลชำระเมื่อ" value={formatDateTime(payment.submitted_at)} />
              )}
              {!!payment?.reviewed_at && (
                <InfoRow label="ตรวจสอบเมื่อ" value={formatDateTime(payment.reviewed_at)} />
              )}
              <Divider />
              {discountTotal > 0 && (
                <>
                  <InfoRow label="ราคาเต็ม" value={formatPrice(listSubtotal, order.currency)} />
                  <InfoRow
                    label="ส่วนลด"
                    value={`-${formatPrice(discountTotal, order.currency)}`}
                    valueColor="success.main"
                  />
                </>
              )}
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

          {!!order.receipt && (
            <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <RiFileTextLine size={22} />
                <Box>
                  <Typography variant="h6">ใบเสร็จรับเงิน</Typography>
                  <Typography variant="caption" color="text.secondary">
                    เอกสารที่ออกโดยระบบ eKru
                  </Typography>
                </Box>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={1.5}>
                <InfoRow label="เลขที่ใบเสร็จ" value={order.receipt.receipt_number} />
                <InfoRow label="วันที่ออก" value={formatDateTime(order.receipt.issued_at)} />
                <InfoRow label="ชื่อผู้รับ" value={order.receipt.buyer_name} />
                {!!order.receipt.buyer_tax_id && (
                  <InfoRow label="เลขผู้เสียภาษี" value={order.receipt.buyer_tax_id} />
                )}
                <InfoRow label="ผู้ออก" value={order.receipt.provider_name} />
                <InfoRow
                  label="สถานะ"
                  value={order.receipt.status === 'issued' ? 'ออกแล้ว' : 'ยกเลิกแล้ว'}
                  valueColor={order.receipt.status === 'issued' ? 'success.main' : 'error.main'}
                />
                {order.receipt.status === 'void' && order.receipt.void_reason && (
                  <Alert severity="error">เหตุผลยกเลิก: {order.receipt.void_reason}</Alert>
                )}
              </Stack>
            </Card>
          )}

          {isPaid && !order.receipt && (
            <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <RiFileTextLine size={22} />
                <Typography variant="h6">ใบเสร็จรับเงิน</Typography>
              </Stack>
              <Alert severity="info" sx={{ mt: 2 }}>
                รายการนี้ชำระเงินแล้ว แต่ระบบยังไม่ได้ออกใบเสร็จรับเงิน
              </Alert>
            </Card>
          )}

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

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} textAlign="right" color={valueColor}>
        {value}
      </Typography>
    </Stack>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  });
}

function resourceTypeLabel(resourceType?: string) {
  if (resourceType === 'digital') return 'ไฟล์ดิจิทัล';
  if (resourceType === 'feature_unlock') return 'License / สิทธิ์';
  if (resourceType === 'service') return 'บริการ';
  if (resourceType === 'physical') return 'สินค้าทั่วไป';
  return 'สินค้า';
}

function licenseScopeLabel(scope?: 'individual' | 'school' | 'teacher') {
  if (scope === 'individual') return 'บุคคล';
  if (scope === 'teacher') return 'Seat ครู';
  return 'โรงเรียน';
}

function licenseStatusLabel(status: string) {
  if (status === 'active') return 'License ใช้งานได้';
  if (status === 'renewed') return 'ต่ออายุแล้ว';
  if (status === 'expired') return 'หมดอายุ';
  if (status === 'revoked') return 'ถูกเพิกถอน';
  if (status === 'refunded') return 'คืนเงินแล้ว';
  return status;
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
