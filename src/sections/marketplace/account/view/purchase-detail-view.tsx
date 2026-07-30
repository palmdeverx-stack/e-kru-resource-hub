'use client';

import type { MarketplaceOrder } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import useMediaQuery from '@mui/material/useMediaQuery';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import {
  RiEyeLine,
  RiBankLine,
  RiCloseLine,
  RiDownloadLine,
  RiBankCardLine,
  RiFileTextLine,
  RiArrowLeftLine,
  RiShieldCheckLine,
  RiExternalLinkLine,
  RiShoppingBag3Line,
  RiDownloadCloud2Line,
} from 'src/components/remix-icon';

import { getMyOrder, formatPrice } from '../../shared/api';
import { hasPurchaseBenefitsContent } from '../../shared/purchase-benefits';
import { PurchaseBenefitsContent } from '../../shared/purchase-benefits-content';

type Props = {
  orderId: string;
};

export function MarketplacePurchaseDetailView({ orderId }: Props) {
  const theme = useTheme();
  const receiptPreviewFullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { currentLang } = useTranslate();
  const isEnglish = currentLang.value === 'en';
  const [order, setOrder] = useState<MarketplaceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [receiptFormOpen, setReceiptFormOpen] = useState(false);
  const [receiptIssuing, setReceiptIssuing] = useState(false);
  const [receiptIssueError, setReceiptIssueError] = useState('');
  const [receiptForm, setReceiptForm] = useState({
    buyerName: '',
    buyerEmail: '',
    buyerTaxId: '',
    buyerAddress: '',
  });

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
  const receiptPdfUrl = `/api/marketplace/orders/${order.id}/receipt`;
  const openReceiptForm = () => {
    setReceiptIssueError('');
    setReceiptForm({
      buyerName: order.receipt?.buyer_name ?? '',
      buyerEmail: order.receipt?.buyer_email ?? '',
      buyerTaxId: order.receipt?.buyer_tax_id ?? '',
      buyerAddress: order.receipt?.buyer_address ?? '',
    });
    setReceiptFormOpen(true);
  };
  const issueReceipt = async () => {
    setReceiptIssuing(true);
    setReceiptIssueError('');
    try {
      const response = await fetch(receiptPdfUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receiptForm),
      });
      const result = (await response.json()) as {
        receipt?: NonNullable<MarketplaceOrder['receipt']>;
        message?: string;
      };
      if (!response.ok || !result.receipt) {
        throw new Error(result.message ?? 'ไม่สามารถออกใบเสร็จรับเงินได้');
      }
      setOrder((current) => (current ? { ...current, receipt: result.receipt } : current));
      setReceiptFormOpen(false);
      setReceiptPreviewOpen(true);
    } catch (issueError) {
      setReceiptIssueError(
        issueError instanceof Error ? issueError.message : 'ไม่สามารถออกใบเสร็จรับเงินได้'
      );
    } finally {
      setReceiptIssuing(false);
    }
  };

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

      {order.status === 'disputed' && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button
              size="small"
              color="inherit"
              component={RouterLink}
              href={paths.legal.complaintDisputePolicy}
              target="_blank"
            >
              อ่านนโยบาย
            </Button>
          }
        >
          คำสั่งซื้อนี้อยู่ระหว่างข้อพิพาท ระบบระงับสิทธิ์ชั่วคราวจนกว่าจะทราบผล
        </Alert>
      )}

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
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              spacing={1.5}
            >
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
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={2}
                      alignItems={{ sm: 'flex-start' }}
                    >
                      <Box
                        sx={{
                          width: { xs: '100%', sm: 120 },
                          aspectRatio: { xs: '16 / 9', sm: '1 / 1' },
                          flexShrink: 0,
                          borderRadius: 2,
                          bgcolor: 'background.neutral',
                          backgroundImage: cover ? `url("${cover}")` : undefined,
                          backgroundSize: 'contain',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat',
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
                            variant="outlined"
                            color="inherit"
                            startIcon={<RiEyeLine />}
                            sx={{ mt: 1.5 }}
                          >
                            ดูรายละเอียดสินค้า
                          </Button>
                        )}
                        {isPaid &&
                          product &&
                          hasPurchaseBenefitsContent(product.purchase_benefits_html, []) && (
                            <Box
                              sx={{
                                p: 1.5,
                                mt: 2,
                                borderRadius: 2,
                                bgcolor: 'primary.lighter',
                                border: '1px solid',
                                borderColor: 'primary.light',
                              }}
                            >
                              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                ข้อความส่งมอบเพิ่มเติม
                              </Typography>
                              <PurchaseBenefitsContent html={product.purchase_benefits_html} />
                            </Box>
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
                                  {license.expires_at
                                    ? `หมดอายุ ${formatDateTime(license.expires_at)}`
                                    : 'สิทธิ์ถาวร · ไม่มีวันหมดอายุ'}
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
                              border: '1px solid',
                              borderColor: 'divider',
                              width: '100%',
                            }}
                          >
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              sx={{ mb: 1.25 }}
                            >
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <RiDownloadCloud2Line size={20} />
                                <Typography variant="subtitle2">ไฟล์ดาวน์โหลด</Typography>
                              </Stack>
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
                                      variant="outlined"
                                      href={file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      startIcon={<RiDownloadCloud2Line />}
                                      sx={{
                                        justifyContent: 'flex-start',
                                        minHeight: 44,
                                        color: 'text.primary',
                                        borderColor: 'divider',
                                        bgcolor: 'background.paper',
                                        '&:hover': {
                                          borderColor: 'primary.main',
                                          bgcolor: 'primary.lighter',
                                        },
                                        '& .MuiButton-startIcon': { color: 'primary.main' },
                                      }}
                                    >
                                      <Box
                                        component="span"
                                        sx={{
                                          minWidth: 0,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {file.file_name}
                                      </Box>
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
                        {isPaid && !!product?.external_links?.length && (
                          <Box
                            sx={{
                              p: 1.5,
                              mt: 2,
                              borderRadius: 2,
                              bgcolor: 'primary.lighter',
                              border: '1px solid',
                              borderColor: 'primary.light',
                            }}
                          >
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              sx={{ mb: 1.25 }}
                            >
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <RiExternalLinkLine size={20} />
                                <Typography variant="subtitle2">ลิงก์ที่ได้รับ</Typography>
                              </Stack>
                              <Chip
                                size="small"
                                label={`${product.external_links.length} ลิงก์`}
                                variant="outlined"
                              />
                            </Stack>
                            <Stack spacing={1}>
                              {product.external_links.map((link, index) => (
                                <Button
                                  key={`${link.url}-${index}`}
                                  component="a"
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  variant="outlined"
                                  endIcon={<RiExternalLinkLine />}
                                  sx={{
                                    justifyContent: 'space-between',
                                    minHeight: 44,
                                    textAlign: 'left',
                                    color: 'text.primary',
                                    borderColor: 'primary.light',
                                    bgcolor: 'background.paper',
                                    '&:hover': {
                                      borderColor: 'primary.main',
                                      bgcolor: 'primary.lighter',
                                    },
                                    '& .MuiButton-endIcon': { color: 'primary.main' },
                                  }}
                                >
                                  {link.label}
                                </Button>
                              ))}
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
                    ? 'ระบบชำระเงินออนไลน์'
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
                    เอกสารที่ออกโดยระบบ E-KRU Marketplace
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
                <Typography variant="caption" color="text.secondary">
                  เปิดดูหรือดาวน์โหลดใบเสร็จได้ทันทีจากหน้านี้
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<RiEyeLine />}
                    onClick={() => setReceiptPreviewOpen(true)}
                  >
                    ดูตัวอย่าง
                  </Button>
                  <Button
                    fullWidth
                    component="a"
                    href={`${receiptPdfUrl}?download=1`}
                    variant="contained"
                    startIcon={<RiDownloadLine />}
                  >
                    ดาวน์โหลด PDF
                  </Button>
                </Stack>
                <Button fullWidth color="inherit" onClick={openReceiptForm}>
                  แก้ไขข้อมูลผู้รับสำหรับเบิก
                </Button>
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
                รายการนี้ชำระเงินแล้ว คุณสามารถออกใบเสร็จและเปิดดูได้ทันที
              </Alert>
              {receiptIssueError && (
                <Alert severity="error" sx={{ mt: 1.5 }}>
                  {receiptIssueError}
                </Alert>
              )}
              <Button
                fullWidth
                variant="contained"
                loading={receiptIssuing}
                startIcon={<RiFileTextLine />}
                onClick={openReceiptForm}
                sx={{ mt: 2 }}
              >
                กรอกข้อมูลและออกใบเสร็จ
              </Button>
            </Card>
          )}

          {/* <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
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
          </Card> */}
        </Stack>
      </Box>

      <Dialog
        open={receiptFormOpen}
        onClose={() => !receiptIssuing && setReceiptFormOpen(false)}
        fullScreen={receiptPreviewFullScreen}
        fullWidth
        maxWidth="sm"
        aria-labelledby="receipt-details-title"
      >
        <DialogTitle id="receipt-details-title">ข้อมูลสำหรับออกใบเสร็จรับเงิน</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2.5 }}>
            หากใช้เบิกในนามโรงเรียนหรือบริษัท กรุณากรอกชื่อ ที่อยู่ และเลขผู้เสียภาษีของหน่วยงาน
            ให้ตรงกับข้อมูลที่ฝ่ายการเงินกำหนด
          </Alert>
          <Stack spacing={2}>
            <TextField
              required
              fullWidth
              label="ชื่อผู้รับ / ชื่อโรงเรียน / ชื่อบริษัท"
              value={receiptForm.buyerName}
              onChange={(event) =>
                setReceiptForm((current) => ({ ...current, buyerName: event.target.value }))
              }
            />
            <TextField
              fullWidth
              label="เลขประจำตัวผู้เสียภาษี (ถ้ามี)"
              value={receiptForm.buyerTaxId}
              onChange={(event) =>
                setReceiptForm((current) => ({
                  ...current,
                  buyerTaxId: event.target.value.replace(/\D/g, '').slice(0, 13),
                }))
              }
              error={Boolean(receiptForm.buyerTaxId && receiptForm.buyerTaxId.length !== 13)}
              helperText={
                receiptForm.buyerTaxId && receiptForm.buyerTaxId.length !== 13
                  ? 'เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก'
                  : 'บุคคลทั่วไปเว้นว่างได้'
              }
            />
            <TextField
              required
              fullWidth
              multiline
              minRows={3}
              label="ที่อยู่สำหรับออกใบเสร็จ"
              value={receiptForm.buyerAddress}
              onChange={(event) =>
                setReceiptForm((current) => ({ ...current, buyerAddress: event.target.value }))
              }
            />
            <TextField
              fullWidth
              type="email"
              label="อีเมล (ถ้ามี)"
              value={receiptForm.buyerEmail}
              onChange={(event) =>
                setReceiptForm((current) => ({ ...current, buyerEmail: event.target.value }))
              }
            />
            {receiptIssueError && <Alert severity="error">{receiptIssueError}</Alert>}
            <Typography variant="caption" color="text.secondary">
              โปรดตรวจสอบข้อมูลให้ถูกต้องก่อนออกใบเสร็จ เนื่องจากเอกสารจะเก็บข้อมูล ณ
              วันที่ออกไว้เป็นหลักฐาน
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button disabled={receiptIssuing} onClick={() => setReceiptFormOpen(false)}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            loading={receiptIssuing}
            onClick={issueReceipt}
            disabled={
              receiptForm.buyerName.trim().length < 2 ||
              receiptForm.buyerAddress.trim().length < 5 ||
              Boolean(receiptForm.buyerTaxId && receiptForm.buyerTaxId.length !== 13)
            }
          >
            {order.receipt ? 'บันทึกและเปิดใบเสร็จ' : 'ยืนยันและออกใบเสร็จ'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={receiptPreviewOpen}
        onClose={() => setReceiptPreviewOpen(false)}
        fullScreen={receiptPreviewFullScreen}
        fullWidth
        maxWidth="lg"
        aria-labelledby="receipt-preview-title"
        slotProps={{
          paper: {
            sx: {
              m: { xs: 0, sm: 3 },
              height: { xs: '100dvh', sm: 'calc(100% - 48px)' },
              maxHeight: 'none',
              borderRadius: { xs: 0, sm: 3 },
            },
          },
        }}
      >
        <DialogTitle id="receipt-preview-title" sx={{ pr: 7 }}>
          ตัวอย่างใบเสร็จรับเงิน {order.receipt?.receipt_number}
          <IconButton
            aria-label="ปิดตัวอย่างใบเสร็จ"
            onClick={() => setReceiptPreviewOpen(false)}
            sx={{ top: 8, right: 8, position: 'absolute' }}
          >
            <RiCloseLine />
          </IconButton>
        </DialogTitle>
        <DialogContent
          dividers
          sx={{ p: 0, display: 'flex', overflow: 'hidden', bgcolor: 'grey.200' }}
        >
          {receiptPreviewOpen && (
            <Box
              component="iframe"
              src={receiptPdfUrl}
              title={`ใบเสร็จรับเงิน ${order.receipt?.receipt_number ?? ''}`}
              sx={{ width: 1, height: 1, border: 0, bgcolor: 'common.white' }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.5, gap: 2 }}>
          <Button onClick={() => setReceiptPreviewOpen(false)}>ปิด</Button>
          <Button
            component="a"
            href={`${receiptPdfUrl}?download=1`}
            variant="contained"
            startIcon={<RiDownloadLine />}
          >
            ดาวน์โหลด PDF
          </Button>
        </DialogActions>
      </Dialog>
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
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
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
  if (status === 'disputed') return 'ระงับระหว่างข้อพิพาท';
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
  if (status === 'disputed') {
    return (
      <Chip
        color="error"
        label="อยู่ระหว่างข้อพิพาท"
        variant="soft"
        sx={{ bgcolor: 'background.paper' }}
      />
    );
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
  if (status === 'disputed') return 'อยู่ระหว่างข้อพิพาท';
  if (status === 'refunded') return 'คืนเงินแล้ว';
  if (status === 'cancelled') return 'ยกเลิก';
  return 'รอชำระเงิน';
}

function paymentStatusLabel(status?: NonNullable<MarketplaceOrder['payment_session']>['status']) {
  if (status === 'verified') return 'ยืนยันแล้ว';
  if (status === 'disputed') return 'อยู่ระหว่างข้อพิพาท';
  if (status === 'payment_review') return 'รอตรวจสอบ';
  if (status === 'rejected') return 'ไม่ผ่านการตรวจสอบ';
  if (status === 'expired') return 'หมดอายุ';
  return 'รอชำระเงิน';
}
