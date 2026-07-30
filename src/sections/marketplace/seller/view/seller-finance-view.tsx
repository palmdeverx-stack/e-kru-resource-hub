'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import CircularProgress from '@mui/material/CircularProgress';

import {
  RiEyeLine,
  RiTimeLine,
  RiBankLine,
  RiCloseLine,
  RiWallet3Line,
  RiCalendarLine,
  RiFileList3Line,
  RiArrowRightSLine,
  RiShoppingBag3Line,
  RiCheckboxCircleLine,
  RiMoneyDollarCircleLine,
} from 'src/components/remix-icon';

import { formatPrice } from '../../shared/api';

type FinanceOrder = {
  id: string;
  currency: string;
  gross_amount: number;
  platform_fee: number;
  payment_fee: number;
  seller_net: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  available_at: string | null;
  payment_session?: {
    payment_method: 'promptpay' | 'stripe' | 'free';
    status: string;
  } | null;
  items?: Array<{
    id: string;
    title: string;
    quantity: number;
    unit_price: number;
    product?: {
      title: string;
      title_en: string | null;
    } | null;
  }>;
};

type LedgerEntry = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  entry_type: string;
  description: string | null;
  available_at: string | null;
  payout_id: string | null;
  created_at: string;
  order: FinanceOrder | FinanceOrder[] | null;
};

type Payout = {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled';
  bank_code_snapshot: string;
  bank_name_snapshot: string;
  account_number_snapshot: string;
  account_name_snapshot: string;
  transfer_reference: string | null;
  failure_reason: string | null;
  requested_at: string;
  processed_at: string | null;
  created_at: string;
};

type FinanceResult = {
  seller: { id: string; display_name: string; status: string };
  balance: {
    grossSales: number;
    underReview: number;
    available: number;
    pending: number;
    processing: number;
    paid: number;
    todayIncome: number;
    monthIncome: number;
  };
  schedule: {
    payoutDay: number;
    minimumPayout: number;
    holdDays: number;
    commissionRate: number;
    commissionSource: 'default' | 'seller_override' | 'system_store';
    nextPayoutAt: string;
  };
  orders: FinanceOrder[];
  ledger: LedgerEntry[];
  payouts: Payout[];
};

type FinanceTab = 'income' | 'sales' | 'payouts';

type MoneyStatus = {
  label: string;
  color: 'default' | 'info' | 'warning' | 'success' | 'error';
};

const payoutStatus = {
  pending: { label: 'รอรอบโอน', color: 'warning' as const },
  processing: { label: 'กำลังโอน', color: 'info' as const },
  paid: { label: 'โอนสำเร็จ', color: 'success' as const },
  failed: { label: 'ระงับยอด', color: 'error' as const },
  cancelled: { label: 'ระงับยอด', color: 'default' as const },
};

function resolveOrder(entry: LedgerEntry) {
  return Array.isArray(entry.order) ? entry.order[0] : entry.order;
}

function currentItemTitle(item: NonNullable<FinanceOrder['items']>[number]) {
  return item.product?.title || item.title;
}

function getMoneyStatus(
  order: FinanceOrder,
  ledger: LedgerEntry[],
  payouts: Payout[]
): MoneyStatus {
  if (order.status === 'refunded') return { label: 'คืนเงิน', color: 'default' };
  if (order.status === 'cancelled') return { label: 'ระงับยอด', color: 'error' };
  if (order.status === 'payment_review') {
    return { label: 'อยู่ระหว่างตรวจสอบ', color: 'warning' };
  }
  if (['pending', 'pending_payment', 'payment_rejected'].includes(order.status)) {
    return { label: 'รอชำระ', color: 'default' };
  }

  const entry = ledger.find((item) => item.order_id === order.id && item.entry_type === 'sale');
  if (!entry) return { label: 'ชำระสำเร็จ', color: 'info' };

  if (entry.payout_id) {
    const payout = payouts.find((item) => item.id === entry.payout_id);
    if (payout?.status === 'paid') return { label: 'โอนสำเร็จ', color: 'success' };
    if (payout?.status === 'processing') return { label: 'กำลังโอน', color: 'info' };
    if (payout?.status === 'pending') return { label: 'รอรอบโอน', color: 'warning' };
  }

  if (entry.available_at && new Date(entry.available_at).getTime() <= Date.now()) {
    return { label: 'พร้อมจ่าย', color: 'success' };
  }
  return { label: 'กำลังเคลียร์ยอด', color: 'warning' };
}

export function MarketplaceSellerFinanceView() {
  const [data, setData] = useState<FinanceResult | null>(null);
  const [activeTab, setActiveTab] = useState<FinanceTab>('income');
  const [selectedOrder, setSelectedOrder] = useState<FinanceOrder | null>(null);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [salesPage, setSalesPage] = useState(0);
  const [salesRowsPerPage, setSalesRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/marketplace/seller/finance', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        setData(result);
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลรายได้ไม่สำเร็จ')
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ minHeight: 480, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const selectedEntries = selectedPayout
    ? (data?.ledger ?? []).filter((entry) => entry.payout_id === selectedPayout.id)
    : [];
  const selectedOrders = selectedEntries
    .map(resolveOrder)
    .filter((order): order is FinanceOrder => Boolean(order));
  const selectedGross = selectedOrders.reduce(
    (total, order) => total + Number(order.gross_amount || 0),
    0
  );
  const selectedPlatformFee = selectedOrders.reduce(
    (total, order) => total + Number(order.platform_fee || 0),
    0
  );
  const selectedPaymentFee = selectedOrders.reduce(
    (total, order) => total + Number(order.payment_fee || 0),
    0
  );
  const payoutDayNames = [
    'วันอาทิตย์',
    'วันจันทร์',
    'วันอังคาร',
    'วันพุธ',
    'วันพฤหัสบดี',
    'วันศุกร์',
    'วันเสาร์',
  ];
  const exampleGross = 100;
  const exampleStripeFee = exampleGross * 0.0365 + 10;
  const examplePlatformFee = exampleGross * ((data?.schedule.commissionRate ?? 0) / 100);
  const exampleSellerNet = Math.max(0, exampleGross - exampleStripeFee - examplePlatformFee);

  const summaryCards = [
    {
      label: 'รายได้วันนี้',
      description: 'รายได้สุทธิจากยอดที่ชำระสำเร็จ',
      amount: data?.balance.todayIncome ?? 0,
      color: 'info.main',
      background: 'info.lighter',
      icon: RiMoneyDollarCircleLine,
    },
    {
      label: 'รายได้เดือนนี้',
      description: 'รายได้สุทธิสะสมของเดือนปัจจุบัน',
      amount: data?.balance.monthIncome ?? 0,
      color: 'primary.main',
      background: 'primary.lighter',
      icon: RiFileList3Line,
    },
    {
      label: 'ยอดรอรับ',
      description: 'ระบบกำลังสรุปยอดให้พร้อมจ่าย',
      amount: (data?.balance.pending ?? 0) + (data?.balance.processing ?? 0),
      color: 'warning.main',
      background: 'warning.lighter',
      icon: RiTimeLine,
    },
    {
      label: 'ยอดพร้อมจ่าย',
      description: 'พร้อมรวมในรอบโอนถัดไป',
      amount: data?.balance.available ?? 0,
      color: 'success.main',
      background: 'success.lighter',
      icon: RiWallet3Line,
    },
    {
      label: 'ยอดที่ได้รับแล้ว',
      description: `${data?.payouts.filter((item) => item.status === 'paid').length ?? 0} รายการโอน`,
      amount: data?.balance.paid ?? 0,
      color: 'primary.main',
      background: 'primary.lighter',
      icon: RiCheckboxCircleLine,
    },
  ];

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Card
        sx={{
          p: { xs: 3, md: 4 },
          mb: 3,
          overflow: 'hidden',
          position: 'relative',
          borderRadius: 4,
          color: 'common.white',
          background: 'linear-gradient(125deg, #102A56 0%, #1558B0 55%, #2389DD 100%)',
        }}
      >
        <Box
          sx={{
            width: 240,
            height: 240,
            right: -60,
            bottom: -140,
            position: 'absolute',
            borderRadius: '50%',
            bgcolor: 'rgba(255,255,255,0.12)',
          }}
        />
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={3}
          sx={{ position: 'relative' }}
        >
          <Box>
            <Chip
              icon={<RiMoneyDollarCircleLine />}
              label="Seller Finance"
              sx={{ mb: 2, color: 'common.white', bgcolor: 'rgba(255,255,255,0.14)' }}
            />
            <Typography component="h1" variant="h3">
              รายได้และการรับเงิน
            </Typography>
            <Typography sx={{ mt: 0.75, color: 'rgba(255,255,255,0.76)' }}>
              ติดตามยอดขาย ยอดพัก และประวัติเงินที่โอนเข้าบัญชีของร้าน
            </Typography>
          </Box>
          <Stack direction="row" spacing={{ xs: 3, md: 5 }}>
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)' }}>
                ยอดขายรวม
              </Typography>
              <Typography variant="h3">
                {formatPrice(Number(data?.balance.grossSales ?? 0))}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)' }}>
                ยอดรอตรวจสอบ
              </Typography>
              <Typography variant="h3">
                {formatPrice(Number(data?.balance.underReview ?? 0))}
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </Card>

      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2.5}>
        {summaryCards.map((item) => {
          const Icon = item.icon;
          return (
            <Grid key={item.label} size={{ xs: 12, sm: 6, lg: 4, xl: 2.4 }}>
              <Card variant="outlined" sx={{ p: 2.75, height: 1, borderRadius: 3 }}>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography color="text.secondary">{item.label}</Typography>
                    <Typography variant="h4" sx={{ mt: 0.75, color: item.color }}>
                      {formatPrice(Number(item.amount))}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.description}
                    </Typography>
                  </Box>
                  <Avatar
                    variant="rounded"
                    sx={{ width: 52, height: 52, color: item.color, bgcolor: item.background }}
                  >
                    <Icon size={25} />
                  </Avatar>
                </Stack>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card variant="outlined" sx={{ mt: 3, borderRadius: 3, overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={(_event, value: FinanceTab) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: { xs: 1, md: 2 }, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Tab value="income" label="รายได้ของฉัน" icon={<RiWallet3Line />} iconPosition="start" />
          <Tab value="sales" label="รายการขาย" icon={<RiShoppingBag3Line />} iconPosition="start" />
          <Tab
            value="payouts"
            label="ประวัติการจ่ายเงิน"
            icon={<RiBankLine />}
            iconPosition="start"
          />
        </Tabs>

        {activeTab === 'income' && (
          <Box sx={{ p: { xs: 2.5, md: 3.5 } }}>
            <Alert severity="success" icon={<RiCalendarLine />} sx={{ mb: 3 }}>
              ยอดที่พร้อมจ่ายจะถูกรวมในรอบถัดไปวันที่{' '}
              {new Date(data?.schedule.nextPayoutAt ?? '').toLocaleDateString('th-TH', {
                dateStyle: 'long',
                timeZone: 'Asia/Bangkok',
              })}{' '}
              · ระบบจัดรอบทุก{payoutDayNames[data?.schedule.payoutDay ?? 5]}
            </Alert>

            <Typography variant="h5">สถานะเงินของคำสั่งซื้อ</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              ดูเส้นทางรายได้แบบสั้นและชัดเจน ระบบจะแสดงวันที่รอบโอนถัดไปให้เสมอ
            </Typography>
            <Box
              sx={{
                gap: 1.5,
                mt: 2.5,
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  lg: 'repeat(4, 1fr)',
                  xl: 'repeat(4, 1fr)',
                },
              }}
            >
              {[
                ['1', 'ขายสำเร็จ', 'รับชำระและบันทึกยอดขายแล้ว'],
                ['2', 'กำลังเคลียร์ยอด', 'ระบบตรวจสอบและสรุปยอดอัตโนมัติ'],
                ['3', 'พร้อมจ่าย', 'ยอดพร้อมรวมในรอบโอนถัดไป'],
                ['4', 'โอนสำเร็จ', 'เงินเข้าบัญชีผู้ขายแล้ว'],
              ].map(([step, title, description]) => (
                <Card key={step} variant="outlined" sx={{ p: 2, bgcolor: 'background.neutral' }}>
                  <Avatar
                    sx={{
                      width: 30,
                      height: 30,
                      mb: 1.5,
                      fontSize: 13,
                      color: 'primary.main',
                      bgcolor: 'primary.lighter',
                    }}
                  >
                    {step}
                  </Avatar>
                  <Typography variant="subtitle2">{title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {description}
                  </Typography>
                </Card>
              ))}
            </Box>

            <Grid container spacing={2.5} sx={{ mt: 2 }}>
              {[
                ['ยอดขายรวม', data?.balance.grossSales ?? 0, 'ยอดคำสั่งซื้อที่ชำระสำเร็จ'],
                ['ยอดรอตรวจสอบ', data?.balance.underReview ?? 0, 'ยังไม่รวมในยอดพร้อมจ่าย'],
                ['ยอดพร้อมถอนได้', data?.balance.available ?? 0, 'พร้อมรวมในรอบโอนถัดไป'],
                ['ยอดที่โอนแล้ว', data?.balance.paid ?? 0, 'โอนเข้าบัญชีสำเร็จ'],
              ].map(([label, amount, description]) => (
                <Grid key={String(label)} size={{ xs: 12, sm: 6, lg: 3 }}>
                  <Card variant="outlined" sx={{ p: 2.5, height: 1 }}>
                    <Typography color="text.secondary">{label}</Typography>
                    <Typography variant="h4" sx={{ mt: 0.75 }}>
                      {formatPrice(Number(amount))}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {description}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {activeTab === 'sales' && (
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              spacing={1}
              sx={{ mb: 2.5 }}
            >
              <Box>
                <Typography variant="h5">รายการขายทั้งหมด</Typography>
                <Typography variant="body2" color="text.secondary">
                  แสดงยอดที่ผู้ซื้อชำระ ผู้รับค่าธรรมเนียม และยอดที่ผู้ขายจะได้รับ
                </Typography>
              </Box>
              <Chip label={`${data?.orders.length ?? 0} รายการ`} variant="outlined" />
            </Stack>

            <TableContainer>
              <Table sx={{ minWidth: 1120 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>วันที่</TableCell>
                    <TableCell>คำสั่งซื้อ</TableCell>
                    <TableCell>สินค้า</TableCell>
                    <TableCell align="right">ยอดขาย</TableCell>
                    <TableCell align="right">Stripe ได้รับ</TableCell>
                    <TableCell align="right">E-KRU ได้รับ</TableCell>
                    <TableCell align="right">ผู้ขายได้รับ</TableCell>
                    <TableCell>สถานะ</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data?.orders.length ? (
                    data.orders
                      .slice(
                        salesPage * salesRowsPerPage,
                        salesPage * salesRowsPerPage + salesRowsPerPage
                      )
                      .map((order) => {
                        const status = getMoneyStatus(order, data.ledger, data.payouts);
                        return (
                          <TableRow key={order.id} hover>
                          <TableCell>
                            {new Date(order.created_at).toLocaleDateString('th-TH', {
                              day: 'numeric',
                              month: 'short',
                              year: '2-digit',
                              timeZone: 'Asia/Bangkok',
                            })}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              ORD-{order.id.slice(0, 8).toUpperCase()}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 280 }}>
                            <Typography variant="body2" noWrap>
                              {order.items?.map(currentItemTitle).join(', ') || '-'}
                            </Typography>
                            {(order.items?.length ?? 0) > 1 && (
                              <Typography variant="caption" color="text.secondary">
                                {order.items?.length} รายการ
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {formatPrice(Number(order.gross_amount), order.currency)}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="subtitle2" color="error.main">
                              {formatPrice(Number(order.payment_fee), order.currency)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ค่าชำระเงิน
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="subtitle2" color="warning.dark">
                              {formatPrice(Number(order.platform_fee), order.currency)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ค่าคอมมิชชัน
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="subtitle2" color="success.main">
                              {formatPrice(Number(order.seller_net), order.currency)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              เข้ายอดรอรับของร้าน
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              variant="soft"
                              color={status.color}
                              label={status.label}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              aria-label="ดูรายละเอียดการคำนวณ"
                              onClick={() => setSelectedOrder(order)}
                            >
                              <RiEyeLine />
                            </IconButton>
                          </TableCell>
                          </TableRow>
                        );
                      })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                        <RiShoppingBag3Line size={42} />
                        <Typography variant="h6" sx={{ mt: 1 }}>
                          ยังไม่มีรายการขาย
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={data?.orders.length ?? 0}
              page={salesPage}
              rowsPerPage={salesRowsPerPage}
              rowsPerPageOptions={[10, 25, 50]}
              labelRowsPerPage="แสดงต่อหน้า"
              labelDisplayedRows={({ from, to, count }) =>
                `${from}–${to} จาก ${count.toLocaleString('th-TH')} รายการ`
              }
              onPageChange={(_event, page) => setSalesPage(page)}
              onRowsPerPageChange={(event) => {
                setSalesRowsPerPage(Number(event.target.value));
                setSalesPage(0);
              }}
            />

            <Stack mt={2}>
              <Alert severity="info" sx={{ mb: 2.5 }}>
                เส้นทางเงิน: ผู้ซื้อชำระยอดขาย → ระบบชำระเงินออนไลน์หักค่าดำเนินการ → E-KRU
                หักค่าคอมมิชชัน → ยอดคงเหลือเป็นรายได้สุทธิของผู้ขาย
              </Alert>

              <Card
                variant="outlined"
                sx={{
                  p: { xs: 2, md: 2.5 },
                  borderColor: 'warning.light',
                  bgcolor: 'warning.lighter',
                }}
              >
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  spacing={2}
                >
                  <Box>
                    <Typography variant="subtitle1">ตัวอย่างการได้รับเงินจริงผ่านบัตร</Typography>
                    <Typography variant="body2" color="text.secondary">
                      สมมติขายสินค้า ฿100 ผ่านบัตรในประเทศ
                    </Typography>
                  </Box>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    divider={<Divider orientation="vertical" flexItem />}
                    spacing={{ xs: 1, sm: 2.5 }}
                  >
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        ระบบชำระเงินออนไลน์ได้รับ
                      </Typography>
                      <Typography variant="subtitle2" color="error.main">
                        {formatPrice(exampleStripeFee)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        3.65% + ฿10
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        ระบบ E-KRU ได้รับ
                      </Typography>
                      <Typography variant="subtitle2" color="warning.dark">
                        {formatPrice(examplePlatformFee)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        คอมมิชชัน {data?.schedule.commissionRate ?? 0}% ·{' '}
                        {data?.schedule.commissionSource === 'system_store'
                          ? 'ร้านทางการ'
                          : data?.schedule.commissionSource === 'seller_override'
                            ? 'อัตราเฉพาะร้าน'
                            : 'อัตรามาตรฐาน'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        ผู้ขายได้รับประมาณ
                      </Typography>
                      <Typography variant="h6" color="success.main">
                        {formatPrice(exampleSellerNet)}
                      </Typography>
                    </Box>
                  </Stack>
                </Stack>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 2 }}
                >
                  ตัวเลขเป็นตัวอย่างก่อนทำรายการ ค่าธรรมเนียมจริงอาจต่างกันตามประเภทบัตร
                  ประเทศของบัตร การแปลงสกุลเงิน และอัตราของผู้ให้บริการ ณ วันที่ชำระ
                </Typography>
              </Card>
            </Stack>
          </Box>
        )}

        {activeTab === 'payouts' && (
          <Box sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
              <Box>
                <Typography variant="h5">ประวัติการจ่ายเงิน</Typography>
                <Typography variant="body2" color="text.secondary">
                  รายการเงินที่รวมยอดและส่งเข้าบัญชีรับเงินของร้าน
                </Typography>
              </Box>
              <Chip
                variant="outlined"
                label={`${data?.payouts.length ?? 0} รายการ`}
                icon={<RiFileList3Line />}
              />
            </Stack>
            <Divider sx={{ my: 2.5 }} />
            <Stack spacing={1.25}>
              {data?.payouts.length ? (
                data.payouts.map((payout) => {
                  const status = payoutStatus[payout.status] ?? payoutStatus.pending;
                  return (
                    <Card
                      key={payout.id}
                      component="button"
                      type="button"
                      variant="outlined"
                      onClick={() => setSelectedPayout(payout)}
                      sx={{
                        p: 2,
                        width: 1,
                        cursor: 'pointer',
                        textAlign: 'left',
                        borderRadius: 2.5,
                        bgcolor: 'background.paper',
                        '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.lighter' },
                      }}
                    >
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                        spacing={2}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar
                            variant="rounded"
                            sx={{ color: 'primary.main', bgcolor: 'primary.lighter' }}
                          >
                            <RiBankLine />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1">
                              {formatPrice(Number(payout.amount), payout.currency)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(payout.requested_at || payout.created_at).toLocaleString(
                                'th-TH',
                                { dateStyle: 'medium', timeStyle: 'short' }
                              )}
                            </Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Chip
                            size="small"
                            variant="soft"
                            color={status.color}
                            label={status.label}
                          />
                          <RiArrowRightSLine />
                        </Stack>
                      </Stack>
                    </Card>
                  );
                })
              ) : (
                <Box sx={{ py: 7, textAlign: 'center' }}>
                  <RiBankLine size={44} />
                  <Typography variant="h6" sx={{ mt: 1.5 }}>
                    ยังไม่มีประวัติการจ่ายเงิน
                  </Typography>
                </Box>
              )}
            </Stack>
            <Alert severity="info" sx={{ mt: 3 }}>
              จ่ายเป็นรอบทุก{payoutDayNames[data?.schedule.payoutDay ?? 5]} · ยอดขั้นต่ำ{' '}
              {formatPrice(Number(data?.schedule.minimumPayout ?? 0))}
              หากต้องการแก้ไขบัญชีรับเงิน ให้ไปที่เมนูข้อมูลร้านค้า
            </Alert>
          </Box>
        )}
      </Card>

      <Dialog
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        fullWidth
        maxWidth="sm"
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        {selectedOrder && (
          <>
            <DialogTitle sx={{ pr: 7 }}>
              <Typography variant="h5">รายละเอียดรายได้คำสั่งซื้อ</Typography>
              <Typography variant="body2" color="text.secondary">
                ORD-{selectedOrder.id.slice(0, 8).toUpperCase()}
              </Typography>
              <IconButton
                aria-label="ปิด"
                onClick={() => setSelectedOrder(null)}
                sx={{ top: 16, right: 16, position: 'absolute' }}
              >
                <RiCloseLine />
              </IconButton>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ py: 3 }}>
              <Stack spacing={3}>
                <Stack spacing={1}>
                  {selectedOrder.items?.map((item) => (
                    <Box key={item.id}>
                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Typography variant="body2">
                          {currentItemTitle(item)}
                          {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                        </Typography>
                        <Typography variant="body2">
                          {formatPrice(Number(item.unit_price) * item.quantity)}
                        </Typography>
                      </Stack>
                      {item.product?.title && item.product.title !== item.title && (
                        <Typography variant="caption" color="text.secondary">
                          ชื่อ ณ วันที่ขาย: {item.title}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
                <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
                  <Typography variant="h6">สูตรคำนวณรายได้</Typography>
                  <Stack spacing={1.5} sx={{ mt: 2 }}>
                    <AmountRow label="ราคาขาย" amount={Number(selectedOrder.gross_amount)} />
                    <AmountRow
                      label="ค่าธรรมเนียม Stripe / ช่องทางชำระ"
                      amount={-Number(selectedOrder.payment_fee)}
                      color="error.main"
                    />
                    <AmountRow
                      label="ค่าคอมมิชชัน E-KRU"
                      amount={-Number(selectedOrder.platform_fee)}
                      color="error.main"
                    />
                    {Math.abs(
                      Number(selectedOrder.seller_net) -
                        (Number(selectedOrder.gross_amount) -
                          Number(selectedOrder.payment_fee) -
                          Number(selectedOrder.platform_fee))
                    ) >= 0.01 && (
                      <AmountRow
                        label="ส่วนปรับปรุงโดย E-KRU"
                        amount={
                          Number(selectedOrder.seller_net) -
                          (Number(selectedOrder.gross_amount) -
                            Number(selectedOrder.payment_fee) -
                            Number(selectedOrder.platform_fee))
                        }
                        color="info.main"
                      />
                    )}
                    <Divider />
                    <AmountRow
                      label="รายได้สุทธิผู้ขาย"
                      amount={Number(selectedOrder.seller_net)}
                      color="success.main"
                      strong
                    />
                  </Stack>
                </Card>
                <Alert severity="info">
                  สถานะเงิน:{' '}
                  {getMoneyStatus(selectedOrder, data?.ledger ?? [], data?.payouts ?? []).label}
                  {selectedOrder.available_at &&
                    ` · พร้อมเข้ารอบจ่ายหลัง ${new Date(
                      selectedOrder.available_at
                    ).toLocaleDateString('th-TH', { dateStyle: 'long' })}`}
                </Alert>
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>

      <Dialog
        open={Boolean(selectedPayout)}
        onClose={() => setSelectedPayout(null)}
        fullWidth
        maxWidth="md"
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        {selectedPayout && (
          <>
            <DialogTitle sx={{ pr: 7 }}>
              <Typography variant="h5">รายละเอียดการรับเงิน</Typography>
              <Typography variant="body2" color="text.secondary">
                #{selectedPayout.id.slice(0, 12).toUpperCase()}
              </Typography>
              <IconButton
                aria-label="ปิด"
                onClick={() => setSelectedPayout(null)}
                sx={{ top: 16, right: 16, position: 'absolute' }}
              >
                <RiCloseLine />
              </IconButton>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ py: 3 }}>
              <Stack spacing={3}>
                <Card
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    color: 'common.white',
                    background: 'linear-gradient(125deg, #102A56 0%, #1565F5 100%)',
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    spacing={2}
                  >
                    <Box>
                      <Typography sx={{ color: 'rgba(255,255,255,0.72)' }}>ยอดรับสุทธิ</Typography>
                      <Typography variant="h3">
                        {formatPrice(Number(selectedPayout.amount), selectedPayout.currency)}
                      </Typography>
                    </Box>
                    <Chip
                      label={payoutStatus[selectedPayout.status].label}
                      color={payoutStatus[selectedPayout.status].color}
                      sx={{ alignSelf: 'flex-start' }}
                    />
                  </Stack>
                </Card>

                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="h6">บัญชีที่รับเงิน</Typography>
                    <Stack spacing={1.5} sx={{ mt: 2 }}>
                      <DetailRow label="ธนาคาร" value={selectedPayout.bank_name_snapshot} />
                      <DetailRow label="ชื่อบัญชี" value={selectedPayout.account_name_snapshot} />
                      <DetailRow label="เลขบัญชี" value={selectedPayout.account_number_snapshot} />
                      <DetailRow
                        label="เลขอ้างอิง"
                        value={selectedPayout.transfer_reference || '-'}
                      />
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="h6">ข้อมูลการดำเนินการ</Typography>
                    <Stack spacing={1.5} sx={{ mt: 2 }}>
                      <DetailRow
                        label="วันที่สร้างรายการ"
                        value={new Date(
                          selectedPayout.requested_at || selectedPayout.created_at
                        ).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
                      />
                      <DetailRow
                        label="วันที่ดำเนินการ"
                        value={
                          selectedPayout.processed_at
                            ? new Date(selectedPayout.processed_at).toLocaleString('th-TH', {
                                timeZone: 'Asia/Bangkok',
                              })
                            : '-'
                        }
                      />
                      <DetailRow
                        label="จำนวนคำสั่งซื้อ"
                        value={`${selectedOrders.length.toLocaleString('th-TH')} รายการ`}
                      />
                    </Stack>
                  </Grid>
                </Grid>

                {!!selectedOrders.length && (
                  <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
                    <Typography variant="h6">สรุปการคำนวณ</Typography>
                    <Stack spacing={1.25} sx={{ mt: 2 }}>
                      <AmountRow label="ยอดขายรวม" amount={selectedGross} />
                      <AmountRow
                        label="ค่าธรรมเนียมระบบ"
                        amount={-selectedPlatformFee}
                        color="error.main"
                      />
                      {!!selectedPaymentFee && (
                        <AmountRow
                          label="ค่าธรรมเนียมการชำระเงิน"
                          amount={-selectedPaymentFee}
                          color="error.main"
                        />
                      )}
                      <Divider />
                      <AmountRow
                        label="ยอดโอนสุทธิ"
                        amount={Number(selectedPayout.amount)}
                        color="success.main"
                        strong
                      />
                    </Stack>
                  </Card>
                )}

                {!!selectedPayout.failure_reason && (
                  <Alert severity="error">
                    สาเหตุที่โอนไม่สำเร็จ: {selectedPayout.failure_reason}
                  </Alert>
                )}
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Container>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
        {value}
      </Typography>
    </Stack>
  );
}

function AmountRow({
  label,
  amount,
  color,
  strong = false,
}: {
  label: string;
  amount: number;
  color?: string;
  strong?: boolean;
}) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant={strong ? 'subtitle1' : 'body2'}>{label}</Typography>
      <Typography variant={strong ? 'h6' : 'body2'} sx={{ color, fontWeight: strong ? 800 : 600 }}>
        {amount < 0 ? `- ${formatPrice(Math.abs(amount))}` : formatPrice(amount)}
      </Typography>
    </Stack>
  );
}
