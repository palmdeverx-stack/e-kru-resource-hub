'use client';

import type { MarketplaceOrder } from '../../shared/types';

import { useMemo, useState, useEffect } from 'react';

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
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import {
  RiEyeLine,
  RiTimeLine,
  RiSearchLine,
  RiDownloadLine,
  RiBankCardLine,
  RiShoppingBag3Line,
  RiCheckboxCircleLine,
  RiMoneyDollarCircleLine,
} from 'src/components/remix-icon';

import { getMyOrders, formatPrice } from '../../shared/api';
import { MarketplaceSellerLink } from '../../shared/seller-link';

type PurchaseFilter = 'all' | 'ready' | 'pending' | 'closed';

export function MarketplacePurchasesView() {
  const router = useRouter();
  const { currentLang } = useTranslate();
  const isEnglish = currentLang.value === 'en';
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<PurchaseFilter>('all');

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
    ['pending', 'pending_payment', 'payment_review', 'payment_rejected'].includes(order.status)
  ).length;
  const paidTotal = orders
    .filter((order) => ['paid', 'completed'].includes(order.status))
    .reduce((sum, order) => sum + Number(order.total), 0);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const isReady = ['paid', 'completed'].includes(order.status);
        const isPending = [
          'pending',
          'pending_payment',
          'payment_review',
          'payment_rejected',
        ].includes(order.status);
        const matchesFilter =
          activeFilter === 'all' ||
          (activeFilter === 'ready' && isReady) ||
          (activeFilter === 'pending' && isPending) ||
          (activeFilter === 'closed' && ['cancelled', 'refunded'].includes(order.status));

        if (!matchesFilter || !normalizedQuery) return matchesFilter;

        const searchableText = [
          order.id,
          order.seller?.display_name,
          ...(order.items ?? []).flatMap((item) => [
            item.title,
            item.product?.title,
            item.product?.title_en,
          ]),
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase();

        return searchableText.includes(normalizedQuery);
      }),
    [activeFilter, normalizedQuery, orders]
  );

  const filters: Array<{ value: PurchaseFilter; label: string; count: number }> = [
    { value: 'all', label: 'ทั้งหมด', count: orders.length },
    { value: 'ready', label: 'พร้อมใช้งาน', count: paidCount },
    { value: 'pending', label: 'รอชำระ/ตรวจสอบ', count: pendingCount },
    {
      value: 'closed',
      label: 'ยกเลิก/คืนเงิน',
      count: orders.filter((order) => ['cancelled', 'refunded'].includes(order.status)).length,
    },
  ];

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Card
        sx={{
          p: { xs: 2.5, md: 4 },
          mb: 3,
          overflow: 'hidden',
          position: 'relative',
          color: 'common.white',
          background:
            'linear-gradient(125deg, var(--palette-primary-darker), var(--palette-primary-main) 72%, var(--palette-info-main))',
          '&::after': {
            width: 220,
            height: 220,
            content: '""',
            borderRadius: '50%',
            position: 'absolute',
            right: { xs: -130, md: -40 },
            bottom: -150,
            bgcolor: 'rgba(255,255,255,0.12)',
          },
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
          spacing={3}
          sx={{ position: 'relative', zIndex: 1 }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              variant="rounded"
              sx={{
                width: 56,
                height: 56,
                color: 'common.white',
                bgcolor: 'rgba(255,255,255,0.16)',
              }}
            >
              <RiShoppingBag3Line size={28} />
            </Avatar>
            <Box>
              <Typography component="h1" variant="h3">
                รายการซื้อของฉัน
              </Typography>
              <Typography sx={{ mt: 0.5, color: 'rgba(255,255,255,0.78)' }}>
                ติดตามการชำระเงินและเข้าถึงสื่อที่ซื้อไว้ได้จากที่เดียว
              </Typography>
            </Box>
          </Stack>
          <Button
            component={RouterLink}
            href={paths.marketplace.dashboardProducts}
            variant="contained"
            color="inherit"
            sx={{
              color: 'primary.darker',
              bgcolor: 'common.white',
              '&:hover': { bgcolor: 'grey.100' },
            }}
          >
            เลือกซื้อสินค้าเพิ่ม
          </Button>
        </Stack>
      </Card>

      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {!loading && orders.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
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
                <Card
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    borderColor: 'divider',
                    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
                  }}
                >
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

      {!loading && orders.length > 0 && (
        <Card variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, mb: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <TextField
              fullWidth
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาชื่อสินค้า ร้านค้า หรือเลขคำสั่งซื้อ"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <RiSearchLine size={20} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ maxWidth: { md: 420 } }}
            />
            <Stack
              direction="row"
              spacing={1}
              sx={{
                pb: { xs: 0.5, md: 0 },
                flexGrow: 1,
                overflowX: 'auto',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              {filters.map((filter) => {
                const selected = activeFilter === filter.value;
                return (
                  <Button
                    key={filter.value}
                    size="small"
                    variant={selected ? 'contained' : 'soft'}
                    color={selected ? 'primary' : 'inherit'}
                    onClick={() => setActiveFilter(filter.value)}
                    sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    {filter.label}
                    <Box component="span" sx={{ ml: 0.75, opacity: 0.72 }}>
                      {filter.count}
                    </Box>
                  </Button>
                );
              })}
            </Stack>
          </Stack>
        </Card>
      )}

      {loading ? (
        <Box sx={{ py: 10, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : filteredOrders.length ? (
        <Grid container spacing={3}>
          {filteredOrders.map((order) => {
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
            const isReady = ['paid', 'completed'].includes(order.status);
            const detailHref = paths.marketplace.purchase(order.id);

            return (
              <Grid key={order.id} size={{ xs: 12, md: 6, lg: 4, xl: 3 }}>
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
                  <Box
                    role="link"
                    tabIndex={0}
                    aria-label={`ดูรายละเอียดคำสั่งซื้อ ${order.id.slice(0, 8).toUpperCase()}`}
                    onClick={() => router.push(detailHref)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        router.push(detailHref);
                      }
                    }}
                    sx={{
                      flexGrow: 1,
                      cursor: 'pointer',
                      '&:focus-visible': {
                        outline: '3px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: -3,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        aspectRatio: '16 / 10',
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
                      <Typography
                        variant="h6"
                        sx={{
                          minHeight: 56,
                          display: '-webkit-box',
                          overflow: 'hidden',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {(isEnglish && product?.title_en) ||
                          product?.title ||
                          firstItem?.title ||
                          'รายการสินค้า'}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mt: 0.5,
                          minHeight: 40,
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
                      <Box
                        sx={{ mt: 2, width: 'fit-content' }}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <MarketplaceSellerLink
                          seller={order.seller}
                          avatarSize={28}
                          fallbackName="ร้านค้า eKru"
                        />
                      </Box>
                      <Divider sx={{ my: 2 }} />
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            เลขที่ #{order.id.slice(0, 8).toUpperCase()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {new Date(order.created_at).toLocaleDateString('th-TH', {
                              dateStyle: 'medium',
                              timeZone: 'Asia/Bangkok',
                            })}
                          </Typography>
                        </Box>
                        <Typography variant="h5" color="primary.main">
                          {formatPrice(Number(order.total), order.currency)}
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>

                  <Divider />
                  <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
                    <Button
                      component={RouterLink}
                      href={detailHref}
                      fullWidth
                      variant="outlined"
                      startIcon={<RiEyeLine />}
                    >
                      ดูรายละเอียด
                    </Button>
                    {isReady && (
                      <Button
                        component={RouterLink}
                        href={detailHref}
                        fullWidth
                        variant="contained"
                        startIcon={<RiDownloadLine />}
                      >
                        ดาวน์โหลด
                      </Button>
                    )}
                    {needsPayment && (
                      <Button
                        component={RouterLink}
                        href={paths.marketplace.dashboardPayment(order.payment_session_id!)}
                        fullWidth
                        variant="contained"
                        startIcon={<RiBankCardLine />}
                      >
                        {order.status === 'pending_payment'
                          ? 'ชำระเงิน'
                          : order.status === 'payment_rejected'
                            ? 'ส่งหลักฐานใหม่'
                            : 'ดูการตรวจสอบ'}
                      </Button>
                    )}
                  </Stack>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      ) : orders.length ? (
        <Card variant="outlined" sx={{ py: 8, textAlign: 'center', borderStyle: 'dashed' }}>
          <RiSearchLine size={44} />
          <Typography variant="h5" sx={{ mt: 2 }}>
            ไม่พบรายการที่ค้นหา
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
            ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ
          </Typography>
          <Button
            variant="soft"
            onClick={() => {
              setQuery('');
              setActiveFilter('all');
            }}
          >
            ล้างตัวกรอง
          </Button>
        </Card>
      ) : (
        <Card variant="outlined" sx={{ py: 9, textAlign: 'center', borderStyle: 'dashed' }}>
          <RiShoppingBag3Line size={48} />
          <Typography variant="h5" sx={{ mt: 2 }}>
            ยังไม่มีรายการซื้อ
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
            เมื่อซื้อสื่อแล้ว รายการและลิงก์ดาวน์โหลดจะแสดงที่นี่
          </Typography>
          <Button
            component={RouterLink}
            href={paths.marketplace.dashboardProducts}
            variant="contained"
          >
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
  if (status === 'disputed') {
    return <Chip color="error" size="small" label="อยู่ระหว่างข้อพิพาท" variant="soft" />;
  }
  if (status === 'cancelled') {
    return <Chip color="default" size="small" label="ยกเลิก" variant="soft" />;
  }
  return <Chip color="info" size="small" label="รอชำระเงิน" variant="soft" />;
}
