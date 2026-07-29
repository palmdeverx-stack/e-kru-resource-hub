'use client';

import type { MarketplaceOrder } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import {
  RiEyeLine,
  RiTimeLine,
  RiStore2Line,
  RiShoppingBag3Line,
  RiCheckboxCircleLine,
  RiMoneyDollarCircleLine,
} from 'src/components/remix-icon';

import { getMyOrders, formatPrice } from '../../shared/api';

export function MarketplacePurchasesView() {
  const { currentLang } = useTranslate();
  const isEnglish = currentLang.value === 'en';
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyOrders()
      .then((result) => setOrders(result.orders))
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'ไม่สามารถโหลดรายการซื้อได้')
      )
      .finally(() => setLoading(false));
  }, []);

  const paidCount = orders.filter((order) => ['paid', 'completed'].includes(order.status)).length;
  const pendingCount = orders.filter((order) =>
    ['pending', 'pending_payment', 'payment_review'].includes(order.status)
  ).length;
  const paidTotal = orders
    .filter((order) => ['paid', 'completed'].includes(order.status))
    .reduce((sum, order) => sum + Number(order.total), 0);

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'flex-end' }}
        spacing={2}
        sx={{ mb: 4 }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            รายการซื้อของฉัน
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            ดูรายละเอียดการซื้อ สถานะการชำระเงิน และดาวน์โหลดสินค้าที่พร้อมใช้งาน
          </Typography>
        </Box>
        <Button component={RouterLink} href="/products" variant="outlined">
          เลือกซื้อสินค้าเพิ่ม
        </Button>
      </Stack>

      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {!loading && orders.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[
            {
              label: 'คำสั่งซื้อทั้งหมด',
              value: orders.length.toLocaleString('th-TH'),
              icon: RiShoppingBag3Line,
              color: 'primary.main',
              background: 'primary.lighter',
            },
            {
              label: 'พร้อมใช้งาน',
              value: paidCount.toLocaleString('th-TH'),
              icon: RiCheckboxCircleLine,
              color: 'success.main',
              background: 'success.lighter',
            },
            {
              label: 'รอชำระ/ตรวจสอบ',
              value: pendingCount.toLocaleString('th-TH'),
              icon: RiTimeLine,
              color: 'warning.main',
              background: 'warning.lighter',
            },
            {
              label: 'ยอดซื้อที่ชำระแล้ว',
              value: formatPrice(paidTotal),
              icon: RiMoneyDollarCircleLine,
              color: 'info.main',
              background: 'info.lighter',
            },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <Grid key={metric.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Card variant="outlined" sx={{ p: 2.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {metric.label}
                      </Typography>
                      <Typography variant="h4" sx={{ mt: 0.5 }}>
                        {metric.value}
                      </Typography>
                    </Box>
                    <Avatar
                      variant="rounded"
                      sx={{ color: metric.color, bgcolor: metric.background }}
                    >
                      <Icon size={21} />
                    </Avatar>
                  </Stack>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {loading ? (
        <Box sx={{ py: 10, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : orders.length ? (
        <Grid container spacing={3}>
          {orders.map((order) => {
            const firstItem = order.items?.[0];
            const product = firstItem?.product;
            const cover =
              product?.images?.find((image) => image.is_cover)?.url ??
              product?.images?.[0]?.url ??
              product?.cover_url ??
              null;
            const moreItems = Math.max(0, (order.items?.length ?? 0) - 1);
            const needsPayment = Boolean(
              order.payment_session_id &&
              ['pending_payment', 'payment_review', 'payment_rejected'].includes(order.status)
            );

            return (
              <Grid key={order.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Card
                  variant="outlined"
                  sx={{
                    height: 1,
                    display: 'flex',
                    overflow: 'hidden',
                    flexDirection: 'column',
                    transition: 'transform 160ms ease, box-shadow 160ms ease',
                    '&:hover': { transform: 'translateY(-3px)', boxShadow: 5 },
                  }}
                >
                  <CardActionArea
                    component={RouterLink}
                    href={paths.marketplace.purchase(order.id)}
                    sx={{ flexGrow: 1, alignItems: 'stretch' }}
                  >
                    <Box
                      sx={{
                        height: 210,
                        bgcolor: 'background.neutral',
                        backgroundImage: cover ? `url("${cover}")` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'grid',
                        placeItems: 'center',
                        position: 'relative',
                      }}
                    >
                      {!cover && <RiShoppingBag3Line size={52} />}
                      <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
                        <OrderStatusChip status={order.status} />
                      </Box>
                      {moreItems > 0 && (
                        <Chip
                          size="small"
                          label={`+${moreItems} สินค้า`}
                          sx={{
                            position: 'absolute',
                            right: 12,
                            bottom: 12,
                            color: 'common.white',
                            bgcolor: 'rgba(0,0,0,0.68)',
                          }}
                        />
                      )}
                    </Box>
                    <Box sx={{ p: 2.5 }}>
                      <Typography variant="h6" noWrap>
                        {(isEnglish && product?.title_en) || firstItem?.title || 'รายการสินค้า'}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mt: 0.5,
                          minHeight: 42,
                          display: '-webkit-box',
                          overflow: 'hidden',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {(isEnglish && product?.short_description_en) ||
                          product?.short_description ||
                          `${order.items?.length ?? 0} รายการจาก ${order.seller?.display_name ?? 'ร้านค้า eKru'}`}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
                        <Avatar
                          src={order.seller?.logo_url ?? undefined}
                          sx={{ width: 28, height: 28 }}
                        >
                          <RiStore2Line size={15} />
                        </Avatar>
                        <Typography variant="body2" noWrap>
                          {order.seller?.display_name ?? 'ร้านค้า eKru'}
                        </Typography>
                      </Stack>
                      <Divider sx={{ my: 2 }} />
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {new Date(order.created_at).toLocaleDateString('th-TH', {
                              dateStyle: 'medium',
                            })}
                          </Typography>
                        </Box>
                        <Typography variant="h5" color="primary.main">
                          {formatPrice(Number(order.total), order.currency)}
                        </Typography>
                      </Stack>
                    </Box>
                  </CardActionArea>

                  <Divider />
                  <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
                    <Button
                      component={RouterLink}
                      href={paths.marketplace.purchase(order.id)}
                      fullWidth
                      variant="outlined"
                      startIcon={<RiEyeLine />}
                    >
                      ดูรายละเอียด
                    </Button>
                    {needsPayment && (
                      <Button
                        component={RouterLink}
                        href={`/checkout/payment/${order.payment_session_id}`}
                        fullWidth
                        variant="contained"
                      >
                        {order.status === 'pending_payment' ? 'ชำระเงิน' : 'ดูการตรวจสอบ'}
                      </Button>
                    )}
                  </Stack>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <Card variant="outlined" sx={{ py: 9, textAlign: 'center', borderStyle: 'dashed' }}>
          <RiShoppingBag3Line size={48} />
          <Typography variant="h5" sx={{ mt: 2 }}>
            ยังไม่มีรายการซื้อ
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
            เมื่อซื้อสื่อแล้ว รายการและลิงก์ดาวน์โหลดจะแสดงที่นี่
          </Typography>
          <Button component={RouterLink} href="/products" variant="contained">
            เลือกดู Marketplace
          </Button>
        </Card>
      )}
    </Container>
  );
}

export function OrderStatusChip({ status }: { status: MarketplaceOrder['status'] }) {
  if (['paid', 'completed'].includes(status)) {
    return <Chip color="success" size="small" label="พร้อมใช้งาน" variant="soft" />;
  }
  if (status === 'payment_review') {
    return <Chip color="warning" size="small" label="รอตรวจสลิป" variant="soft" />;
  }
  if (status === 'payment_rejected') {
    return <Chip color="error" size="small" label="สลิปไม่ผ่าน" variant="soft" />;
  }
  if (status === 'refunded') {
    return <Chip color="default" size="small" label="คืนเงินแล้ว" variant="soft" />;
  }
  if (status === 'cancelled') {
    return <Chip color="default" size="small" label="ยกเลิก" variant="soft" />;
  }
  return <Chip color="info" size="small" label="รอชำระเงิน" variant="soft" />;
}
