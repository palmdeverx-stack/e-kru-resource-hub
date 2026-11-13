'use client';

import type { MarketplaceOrder } from '../../shared/types';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, useDeferredValue } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import {
  RiEyeLine,
  RiTimeLine,
  RiSearchLine,
  RiBankCardLine,
  RiDownloadLine,
  RiShoppingBag3Line,
  RiCheckboxCircleLine,
  RiMoneyDollarCircleLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { formatPrice, getMyOrders } from '../../shared/api';
import { PurchasedAppButton } from '../purchased-app-button';
import { MarketplaceSellerLink } from '../../shared/seller-link';

const EMPTY_ORDERS: MarketplaceOrder[] = [];
const purchaseDateFormatter = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeZone: 'Asia/Bangkok',
});

type PurchaseFilter = 'all' | 'ready' | 'pending' | 'closed';

export function MarketplacePurchasesView() {
  const { currentLang } = useTranslate();
  const isEnglish = currentLang.value === 'en';
  const { user } = useAuthContext();
  const {
    data,
    isPending: loading,
    error: loadError,
  } = useQuery({
    queryKey: ['my-purchases', user?.id, user?.role],
    enabled: Boolean(user?.id),
    queryFn: ({ signal }) => getMyOrders({ summary: true, signal }),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const orders = data?.orders ?? EMPTY_ORDERS;
  const error = loadError?.message ?? '';
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'orders' | 'items'>('orders');
  const [activeFilter, setActiveFilter] = useState<PurchaseFilter>('all');

  const { indexedOrders, paidCount, pendingCount, closedCount, paidTotal } = useMemo(() => {
    let paid = 0;
    let pending = 0;
    let closed = 0;
    let total = 0;
    const indexed = orders.map((order) => {
      const ready = ['paid', 'completed'].includes(order.status);
      const awaiting = [
        'pending',
        'pending_payment',
        'payment_review',
        'payment_rejected',
      ].includes(order.status);
      const finished = ['cancelled', 'refunded'].includes(order.status);
      if (ready) {
        paid += 1;
        total += Number(order.total);
      }
      if (awaiting) pending += 1;
      if (finished) closed += 1;
      const searchText = [
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
      return { order, ready, awaiting, finished, searchText };
    });
    return {
      indexedOrders: indexed,
      paidCount: paid,
      pendingCount: pending,
      closedCount: closed,
      paidTotal: total,
    };
  }, [orders]);
  const normalizedQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const filteredOrders = useMemo(
    () =>
      indexedOrders
        .filter((entry) => {
          const matches =
            activeFilter === 'all' ||
            (activeFilter === 'ready' && entry.ready) ||
            (activeFilter === 'pending' && entry.awaiting) ||
            (activeFilter === 'closed' && entry.finished);
          return matches && (!normalizedQuery || entry.searchText.includes(normalizedQuery));
        })
        .map((entry) => entry.order),
    [activeFilter, normalizedQuery, indexedOrders]
  );

  const purchasedItems = useMemo(
    () =>
      orders
        .filter((order) => ['paid', 'completed'].includes(order.status))
        .flatMap((order) => (order.items ?? []).map((item) => ({ order, item })))
        .filter(
          ({ order, item }) =>
            !normalizedQuery ||
            [
              item.title,
              item.product?.title,
              item.product?.title_en,
              order.seller?.display_name,
              order.id,
            ]
              .filter(Boolean)
              .join(' ')
              .toLocaleLowerCase()
              .includes(normalizedQuery)
        ),
    [orders, normalizedQuery]
  );

  const filters: Array<{ value: PurchaseFilter; label: string; count: number }> = [
    { value: 'all', label: 'ทั้งหมด', count: orders.length },
    { value: 'ready', label: 'พร้อมใช้งาน', count: paidCount },
    { value: 'pending', label: 'รอชำระ/ตรวจสอบ', count: pendingCount },
    {
      value: 'closed',
      label: 'ยกเลิก/คืนเงิน',
      count: closedCount,
    },
  ];

  return (
    <Container maxWidth={false} sx={{ px: { xs: 1.5, sm: 2.5, lg: 4 }, py: { xs: 2, md: 3 } }}>
      <Card
        sx={{
          p: { xs: 2, sm: 2.5, md: 4 },
          mb: { xs: 2, md: 3 },
          borderRadius: { xs: 2.5, md: 3 },
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
          spacing={{ xs: 2, sm: 3 }}
          sx={{ position: 'relative', zIndex: 1 }}
        >
          <Stack direction="row" spacing={{ xs: 1.25, sm: 2 }} alignItems="center">
            <Avatar
              variant="rounded"
              sx={{
                width: { xs: 44, sm: 56 },
                height: { xs: 44, sm: 56 },
                color: 'common.white',
                bgcolor: 'rgba(255,255,255,0.16)',
              }}
            >
              <RiShoppingBag3Line size={24} />
            </Avatar>
            <Box>
              <Typography
                component="h1"
                variant="h3"
                sx={{ fontSize: { xs: '1.55rem', sm: '2rem', md: '2.5rem' } }}
              >
                รายการซื้อของฉัน
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 0.5, color: 'rgba(255,255,255,0.78)', lineHeight: 1.55 }}
              >
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
              width: { xs: 1, sm: 'auto' },
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

      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value)}
        aria-label="มุมมองรายการซื้อ"
        sx={{ mb: 2 }}
      >
        <Tab value="orders" label="คำสั่งซื้อ" />
        <Tab value="items" label="สินค้าที่ซื้อ" />
      </Tabs>

      {!loading && orders.length > 0 && (
        <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: { xs: 2, md: 3 } }}>
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
              <Grid key={metric.label} size={{ xs: 6, lg: 3 }}>
                <Card
                  variant="outlined"
                  sx={{
                    p: { xs: 1.5, sm: 2.5 },
                    height: 1,
                    minHeight: { xs: 104, sm: 0 },
                    borderColor: 'divider',
                    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    spacing={1}
                  >
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {metric.label}
                      </Typography>
                      <Typography
                        variant="h4"
                        sx={{ mt: 0.5, fontSize: { xs: '1.35rem', sm: '1.75rem' } }}
                      >
                        {metric.value}
                      </Typography>
                    </Box>
                    <Avatar
                      variant="rounded"
                      sx={{
                        width: { xs: 34, sm: 40 },
                        height: { xs: 34, sm: 40 },
                        color: metric.color,
                        flexShrink: 0,
                        bgcolor: metric.background,
                      }}
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
        <Card
          variant="outlined"
          sx={{ p: { xs: 1.25, md: 2 }, mb: { xs: 2, md: 3 }, borderRadius: 2.5 }}
        >
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
              {activeTab === 'orders' &&
                filters.map((filter) => {
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
      ) : activeTab === 'items' ? (
        purchasedItems.length ? (
          <Grid container spacing={2}>
            {purchasedItems.map(({ order, item }) => {
              const product = item.product;
              const cover =
                product?.images?.find((image) => image.is_cover)?.url ||
                product?.images?.[0]?.url ||
                product?.cover_url;
              const title =
                (isEnglish && product?.title_en) || item.title || product?.title || 'รายการสินค้า';
              const detailHref = paths.marketplace.purchase(order.id);
              return (
                <Grid key={`${order.id}-${item.id}`} size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}>
                  <Card
                    variant="outlined"
                    sx={{ height: 1, display: 'flex', flexDirection: 'column', borderRadius: 2.5 }}
                  >
                    <Box
                      component={RouterLink}
                      href={detailHref}
                      sx={{
                        height: 140,
                        bgcolor: 'background.neutral',
                        display: 'grid',
                        placeItems: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {cover ? (
                        <Box
                          component="img"
                          src={cover}
                          alt={title}
                          loading="lazy"
                          sx={{ width: 1, height: 1, objectFit: 'cover' }}
                        />
                      ) : (
                        <RiShoppingBag3Line size={40} />
                      )}
                    </Box>
                    <Stack spacing={1} sx={{ p: 1.75, flex: 1 }}>
                      <Typography variant="subtitle1" sx={{ overflowWrap: 'anywhere' }}>
                        {title}
                      </Typography>
                      <MarketplaceSellerLink seller={order.seller} avatarSize={24} />
                      <Typography variant="caption" color="text.secondary">
                        คำสั่งซื้อ #{order.id.slice(0, 8).toUpperCase()} · จำนวน{' '}
                        {item.quantity ?? '—'}
                      </Typography>
                      <Typography variant="subtitle1" color="primary.main">
                        {item.unit_price != null && item.quantity != null
                          ? formatPrice(
                              Number(item.unit_price) * Number(item.quantity),
                              order.currency
                            )
                          : '—'}
                      </Typography>
                    </Stack>
                    <Stack spacing={1} sx={{ p: 1.25 }}>
                      <Button
                        component={RouterLink}
                        href={detailHref}
                        size="small"
                        variant="outlined"
                        startIcon={<RiEyeLine />}
                      >
                        ดูรายละเอียด
                      </Button>
                      {product?.resource_type === 'feature_unlock' ? (
                        <PurchasedAppButton product={product} fullWidth />
                      ) : (
                        <Button
                          component={RouterLink}
                          href={detailHref}
                          size="small"
                          variant="contained"
                          startIcon={<RiDownloadLine />}
                        >
                          ดูไฟล์และดาวน์โหลด
                        </Button>
                      )}
                    </Stack>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        ) : (
          <Card variant="outlined" sx={{ p: 5, textAlign: 'center' }}>
            <Typography variant="h6">
              {normalizedQuery ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้าที่ชำระสำเร็จ'}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              ติดตามรายการรอชำระหรือยกเลิกได้ในแท็บคำสั่งซื้อ
            </Typography>
          </Card>
        )
      ) : filteredOrders.length ? (
        <Stack spacing={1.5}>
          {filteredOrders.map((order) => {
            const needsPayment = Boolean(
              order.payment_session_id &&
              ['pending_payment', 'payment_review', 'payment_rejected'].includes(order.status)
            );
            return (
              <Card
                key={order.id}
                variant="outlined"
                sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}
              >
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  alignItems={{ md: 'center' }}
                >
                  <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      useFlexGap
                      flexWrap="wrap"
                    >
                      <Typography variant="subtitle1">
                        คำสั่งซื้อ #{order.id.slice(0, 8).toUpperCase()}
                      </Typography>
                      <OrderStatusChip status={order.status} />
                    </Stack>
                    <MarketplaceSellerLink seller={order.seller} avatarSize={24} />
                    <Typography variant="caption" color="text.secondary">
                      {purchaseDateFormatter.format(new Date(order.created_at))} ·{' '}
                      {order.items?.length ?? 0} รายการ
                    </Typography>
                  </Stack>
                  <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                    <Typography variant="caption" color="text.secondary">
                      ยอดรวมคำสั่งซื้อ
                    </Typography>
                    <Typography variant="h6" color="primary.main">
                      {formatPrice(Number(order.total), order.currency)}
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: 'row', md: 'column' }} spacing={1}>
                    <Button
                      component={RouterLink}
                      href={paths.marketplace.purchase(order.id)}
                      size="small"
                      variant="outlined"
                      startIcon={<RiEyeLine />}
                    >
                      ดูรายละเอียด
                    </Button>
                    {needsPayment && (
                      <Button
                        component={RouterLink}
                        href={paths.marketplace.dashboardPayment(order.payment_session_id!)}
                        size="small"
                        variant="contained"
                        startIcon={<RiBankCardLine />}
                      >
                        {order.status === 'pending_payment' ? 'ชำระเงิน' : 'ดูสถานะการชำระ'}
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Card>
            );
          })}
        </Stack>
      ) : orders.length ? (
        <Card
          variant="outlined"
          sx={{ px: 2, py: { xs: 6, md: 8 }, textAlign: 'center', borderStyle: 'dashed' }}
        >
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
        <Card
          variant="outlined"
          sx={{ py: 7, px: 3, textAlign: 'center', borderRadius: 3, borderStyle: 'dashed' }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              mx: 'auto',
              display: 'grid',
              borderRadius: 3,
              placeItems: 'center',
              color: 'primary.main',
              bgcolor: 'primary.lighter',
            }}
          >
            <RiShoppingBag3Line size={48} />
          </Box>
          <Typography variant="h5" sx={{ mt: 3 }}>
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
