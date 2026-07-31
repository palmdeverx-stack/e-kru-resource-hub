'use client';

import type { RemixiconComponentType } from '@remixicon/react';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import LinearProgress from '@mui/material/LinearProgress';
import TableContainer from '@mui/material/TableContainer';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { Chart, useChart } from 'src/components/chart';
import {
  RiEyeLine,
  RiUserLine,
  RiStore2Line,
  RiGlobalLine,
  RiRefreshLine,
  RiDownloadLine,
  RiBarChartBoxLine,
  RiShoppingBag3Line,
  RiMoneyDollarCircleLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { formatPrice } from '../../shared/api';

type RankedItem = { label: string; pageviews: number; visitors: number };

type MarketingOverview = {
  days: number;
  period: { since: string; until: string };
  generatedAt: string;
  setupRequired?: boolean;
  marketplace: {
    summary: {
      orders: number;
      grossSales: number;
      platformRevenue: number;
      unitsSold: number;
      productViews: number;
      productVisitors: number;
      newUsers: number;
      newSellers: number;
      newProducts: number;
    };
    daily: Array<{
      date: string;
      orders: number;
      sales: number;
      product_views: number;
      new_users: number;
    }>;
    topProducts: Array<{
      product_id: string;
      title: string;
      units_sold: number;
      revenue: number;
      views: number;
    }>;
    topSellers: Array<{
      seller_id: string;
      display_name: string;
      orders: number;
      revenue: number;
      units_sold: number;
    }>;
  };
  vercel: {
    connected: boolean;
    message?: string;
    pageviews: number;
    visitors: number;
    daily: Array<{ date: string; pageviews: number; visitors: number }>;
    topPages: RankedItem[];
    topReferrers: RankedItem[];
    devices: RankedItem[];
    countries: RankedItem[];
  };
};

const numberFormat = new Intl.NumberFormat('th-TH');
const dateFormat = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' });

function csvCell(value: string | number) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadReport(data: MarketingOverview) {
  const { summary } = data.marketplace;
  const conversion = data.vercel.visitors ? (summary.orders / data.vercel.visitors) * 100 : 0;
  const rows: Array<Array<string | number>> = [
    ['รายงานภาพรวมการตลาด E-KRU Marketplace'],
    [
      'ช่วงข้อมูล',
      `${dateFormat.format(new Date(data.period.since))} - ${dateFormat.format(new Date(data.period.until))}`,
    ],
    ['สร้างรายงานเมื่อ', new Date(data.generatedAt).toLocaleString('th-TH')],
    [],
    ['KPI', 'ค่า', 'แหล่งข้อมูล'],
    ['ผู้เข้าชมเว็บไซต์', data.vercel.visitors, 'Vercel Web Analytics'],
    ['Page views', data.vercel.pageviews, 'Vercel Web Analytics'],
    ['ยอดขายรวม (บาท)', summary.grossSales, 'Marketplace'],
    ['คำสั่งซื้อสำเร็จ', summary.orders, 'Marketplace'],
    ['Conversion rate (%)', conversion.toFixed(2), 'Vercel + Marketplace'],
    ['สมาชิกใหม่', summary.newUsers, 'Marketplace'],
    ['ร้านค้าใหม่', summary.newSellers, 'Marketplace'],
    ['สินค้าใหม่', summary.newProducts, 'Marketplace'],
    [],
    ['Top pages', 'Page views', 'Visitors'],
    ...data.vercel.topPages.map((item) => [item.label, item.pageviews, item.visitors]),
    [],
    ['แหล่งที่มา', 'Page views', 'Visitors'],
    ...data.vercel.topReferrers.map((item) => [item.label, item.pageviews, item.visitors]),
    [],
    ['Top สินค้า', 'ยอดขาย (บาท)', 'จำนวนขาย', 'ยอดดูสินค้า'],
    ...data.marketplace.topProducts.map((item) => [
      item.title,
      item.revenue,
      item.units_sold,
      item.views,
    ]),
    [],
    ['Top ร้านค้า', 'ยอดขาย (บาท)', 'คำสั่งซื้อ', 'จำนวนขาย'],
    ...data.marketplace.topSellers.map((item) => [
      item.display_name,
      item.revenue,
      item.orders,
      item.units_sold,
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `e-kru-marketing-overview-${data.period.since.slice(0, 10)}-${data.period.until.slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function RankingCard({ title, items }: { title: string; items: RankedItem[] }) {
  const max = Math.max(...items.map((item) => item.pageviews), 1);
  return (
    <Card variant="outlined" sx={{ p: 3, height: '100%' }}>
      <Typography variant="h6">{title}</Typography>
      <Stack spacing={2.25} sx={{ mt: 2.5 }}>
        {items.length ? (
          items.slice(0, 6).map((item) => (
            <Box key={item.label}>
              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Typography variant="body2" noWrap title={item.label} sx={{ minWidth: 0 }}>
                  {item.label || 'โดยตรง / ไม่ระบุ'}
                </Typography>
                <Typography variant="subtitle2">{numberFormat.format(item.pageviews)}</Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={(item.pageviews / max) * 100}
                sx={{ mt: 1, height: 5, borderRadius: 1 }}
              />
            </Box>
          ))
        ) : (
          <Typography color="text.secondary" variant="body2">
            ยังไม่มีข้อมูลในช่วงเวลานี้
          </Typography>
        )}
      </Stack>
    </Card>
  );
}

export function MarketplaceMarketingOverviewView() {
  const { user } = useAuthContext();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<MarketingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');
      try {
        const response = await fetch(`/api/marketplace/admin/marketing-overview?days=${days}`, {
          cache: 'no-store',
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? 'โหลดข้อมูลไม่สำเร็จ');
        setData(result);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [days]
  );

  useEffect(() => {
    load();
  }, [load]);

  const chartOptions = useChart({
    chart: { stacked: false },
    xaxis: {
      categories: data?.vercel.daily.map((item) =>
        new Date(item.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
      ),
    },
    yaxis: { min: 0, forceNiceScale: true },
    legend: { show: true },
    tooltip: { shared: true, intersect: false },
  });

  const chartSeries = useMemo(
    () => [
      { name: 'Page views', data: data?.vercel.daily.map((item) => item.pageviews) ?? [] },
      { name: 'ผู้เข้าชม', data: data?.vercel.daily.map((item) => item.visitors) ?? [] },
    ],
    [data]
  );

  if (user?.role !== 'master_admin') {
    return (
      <Container maxWidth={false} sx={{ py: 6 }}>
        <Alert severity="error">หน้านี้สำหรับ Super Admin เท่านั้น</Alert>
      </Container>
    );
  }

  const summary = data?.marketplace.summary;
  const conversion = data?.vercel.visitors
    ? ((summary?.orders ?? 0) / data.vercel.visitors) * 100
    : 0;
  const averageOrder = summary?.orders ? summary.grossSales / summary.orders : 0;
  const metrics = [
    {
      label: 'ผู้เข้าชมเว็บไซต์',
      value: numberFormat.format(data?.vercel.visitors ?? 0),
      detail: `${numberFormat.format(data?.vercel.pageviews ?? 0)} page views`,
      icon: RiUserLine,
      color: 'primary.main',
    },
    {
      label: 'คำสั่งซื้อสำเร็จ',
      value: numberFormat.format(summary?.orders ?? 0),
      detail: `${numberFormat.format(summary?.unitsSold ?? 0)} ชิ้น`,
      icon: RiShoppingBag3Line,
      color: 'info.main',
    },
    {
      label: 'ยอดขายรวม',
      value: formatPrice(summary?.grossSales ?? 0),
      detail: `เฉลี่ย ${formatPrice(averageOrder)} / ออเดอร์`,
      icon: RiMoneyDollarCircleLine,
      color: 'success.main',
    },
    {
      label: 'Conversion rate',
      value: `${conversion.toFixed(2)}%`,
      detail: 'คำสั่งซื้อ ÷ ผู้เข้าชมเว็บไซต์',
      icon: RiBarChartBoxLine,
      color: 'warning.main',
    },
  ];

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3, md: 4 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <RiBarChartBoxLine size={30} />
            <Typography variant="h3">ภาพรวมการตลาด</Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            รวม Traffic จาก Vercel กับผลลัพธ์ทางธุรกิจของ Marketplace สำหรับวางแผนและนำเสนอผลงาน
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={days}
            onChange={(_, value) => value && setDays(value)}
          >
            <ToggleButton value={7}>7 วัน</ToggleButton>
            <ToggleButton value={30}>30 วัน</ToggleButton>
            <ToggleButton value={90}>90 วัน</ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="outlined"
            startIcon={<RiRefreshLine />}
            disabled={refreshing}
            onClick={() => load(true)}
          >
            รีเฟรช
          </Button>
          <Button
            variant="contained"
            startIcon={<RiDownloadLine />}
            disabled={!data}
            onClick={() => data && downloadReport(data)}
          >
            Export CSV
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}
      {data?.setupRequired && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          กรุณารัน migration 202607310011 เพื่อเปิดสถิติ Marketplace สำหรับหน้านี้
        </Alert>
      )}
      {data && !data.vercel.connected && (
        <Alert severity="info" sx={{ mt: 3 }}>
          <strong>ยังไม่ได้เชื่อม Vercel Web Analytics:</strong> {data.vercel.message}{' '}
          ข้อมูลยอดขายและการใช้งาน Marketplace ยังแสดงและ Export ได้ตามปกติ
        </Alert>
      )}

      <Grid container spacing={2.5} sx={{ mt: 1 }}>
        {metrics.map((metric) => (
          <Grid key={metric.label} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card variant="outlined" sx={{ p: 2.5, height: '100%' }}>
              {loading ? (
                <Skeleton variant="rounded" height={92} />
              ) : (
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box
                    sx={{ p: 1.25, borderRadius: 2, color: metric.color, bgcolor: 'action.hover' }}
                  >
                    <metric.icon size={25} />
                  </Box>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      {metric.label}
                    </Typography>
                    <Typography variant="h4" sx={{ my: 0.5 }}>
                      {metric.value}
                    </Typography>
                    <Typography color="text.secondary" variant="caption">
                      {metric.detail}
                    </Typography>
                  </Box>
                </Stack>
              )}
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 3 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card variant="outlined" sx={{ p: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6">แนวโน้ม Traffic</Typography>
                <Typography variant="body2" color="text.secondary">
                  ผู้เข้าชมแบบไม่ระบุตัวตนจาก Vercel
                </Typography>
              </Box>
              <Chip
                size="small"
                icon={<RiGlobalLine />}
                color={data?.vercel.connected ? 'success' : 'default'}
                label={data?.vercel.connected ? 'เชื่อม Vercel แล้ว' : 'ยังไม่เชื่อม Vercel'}
              />
            </Stack>
            {loading ? (
              <Skeleton height={340} />
            ) : (
              <Chart
                type="area"
                series={chartSeries}
                options={chartOptions}
                sx={{ height: 340, mt: 2 }}
              />
            )}
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card variant="outlined" sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6">การเติบโตในช่วงนี้</Typography>
            <Stack divider={<Divider flexItem />} spacing={2.5} sx={{ mt: 2.5 }}>
              {(
                [
                  ['สมาชิกใหม่', summary?.newUsers ?? 0, RiUserLine],
                  ['ร้านค้าใหม่', summary?.newSellers ?? 0, RiStore2Line],
                  ['สินค้าใหม่', summary?.newProducts ?? 0, RiShoppingBag3Line],
                  ['ผู้ชมหน้าสินค้า', summary?.productVisitors ?? 0, RiEyeLine],
                ] as [string, number, RemixiconComponentType][]
              ).map(([label, value, Icon]) => (
                <Stack
                  key={String(label)}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Icon size={20} />
                    <Typography>{label}</Typography>
                  </Stack>
                  <Typography variant="h6">{numberFormat.format(Number(value))}</Typography>
                </Stack>
              ))}
            </Stack>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <RankingCard title="หน้าที่ได้รับความสนใจ" items={data?.vercel.topPages ?? []} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <RankingCard title="แหล่งที่มาของผู้เข้าชม" items={data?.vercel.topReferrers ?? []} />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 3 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card variant="outlined">
            <Box sx={{ p: 3 }}>
              <Typography variant="h6">สินค้าที่สร้างผลงานสูงสุด</Typography>
              <Typography variant="body2" color="text.secondary">
                เรียงจากรายได้และความสนใจในช่วงที่เลือก
              </Typography>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>สินค้า</TableCell>
                    <TableCell align="right">ยอดดู</TableCell>
                    <TableCell align="right">จำนวนขาย</TableCell>
                    <TableCell align="right">ยอดขาย</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data?.marketplace.topProducts ?? []).map((item) => (
                    <TableRow key={item.product_id} hover>
                      <TableCell>
                        <Typography variant="subtitle2">{item.title}</Typography>
                      </TableCell>
                      <TableCell align="right">{numberFormat.format(item.views)}</TableCell>
                      <TableCell align="right">{numberFormat.format(item.units_sold)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2" color="success.main">
                          {formatPrice(item.revenue)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!data?.marketplace.topProducts.length && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        ยังไม่มีข้อมูลในช่วงเวลานี้
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card variant="outlined">
            <Box sx={{ p: 3 }}>
              <Typography variant="h6">ร้านค้าที่สร้างยอดขายสูงสุด</Typography>
              <Typography variant="body2" color="text.secondary">
                ใช้ประกอบการดูแล Partner และวางแผนแคมเปญ
              </Typography>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ร้านค้า</TableCell>
                    <TableCell align="right">ออเดอร์</TableCell>
                    <TableCell align="right">ยอดขาย</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data?.marketplace.topSellers ?? []).map((item) => (
                    <TableRow key={item.seller_id} hover>
                      <TableCell>
                        <Typography variant="subtitle2">{item.display_name}</Typography>
                      </TableCell>
                      <TableCell align="right">{numberFormat.format(item.orders)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2" color="success.main">
                          {formatPrice(item.revenue)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!data?.marketplace.topSellers.length && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        ยังไม่มีข้อมูลในช่วงเวลานี้
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      </Grid>

      <Alert severity="success" icon={<RiDownloadLine />} sx={{ mt: 2.5 }}>
        Export CSV เป็นรายงานข้อมูลรวม ไม่มีชื่อ อีเมล หรือข้อมูลส่วนบุคคลของลูกค้า พร้อมเปิดใน
        Excel และนำไปทำ Proposal ได้
      </Alert>
    </Container>
  );
}
