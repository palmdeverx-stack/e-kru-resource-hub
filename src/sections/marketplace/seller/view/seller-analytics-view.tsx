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
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import TableContainer from '@mui/material/TableContainer';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Chart, useChart } from 'src/components/chart';
import {
  RiEyeLine,
  RiSearchLine,
  RiStore2Line,
  RiRefreshLine,
  RiDownloadLine,
  RiBarChartBoxLine,
  RiShoppingBag3Line,
  RiMoneyDollarCircleLine,
} from 'src/components/remix-icon';

import { formatPrice } from '../../shared/api';

type DailyStat = {
  date: string;
  orders: number;
  gross_sales: number;
  net_revenue: number;
  units_sold: number;
  product_views: number;
  visitors: number;
};

type ProductStat = {
  product_id: string;
  title: string;
  status: string;
  product_views: number;
  visitors: number;
  orders: number;
  units_sold: number;
  gross_sales: number;
  net_revenue: number;
};

type SearchTermStat = {
  query: string;
  display_query: string;
  searches: number;
  product_impressions: number;
  matched_products: number;
  last_searched_at: string;
};

type SellerAnalytics = {
  seller: { id: string; display_name: string; status: string };
  days: number;
  period: { since: string; until: string };
  generatedAt: string;
  setupRequired?: boolean;
  analytics: {
    summary: {
      products: number;
      publishedProducts: number;
      orders: number;
      grossSales: number;
      netRevenue: number;
      unitsSold: number;
      productViews: number;
      visitors: number;
    };
    daily: DailyStat[];
    products: ProductStat[];
    searchSummary: {
      searches: number;
      uniqueTerms: number;
      productImpressions: number;
    };
    searchTerms: SearchTermStat[];
  };
};

const numberFormat = new Intl.NumberFormat('th-TH');
const dateFormat = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' });

function csvCell(value: string | number) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadReport(data: SellerAnalytics) {
  const { summary, products } = data.analytics;
  const rows: Array<Array<string | number>> = [
    [`รายงานสถิติร้าน ${data.seller.display_name}`],
    [
      'ช่วงข้อมูล',
      `${dateFormat.format(new Date(data.period.since))} - ${dateFormat.format(new Date(data.period.until))}`,
    ],
    ['สร้างรายงานเมื่อ', new Date(data.generatedAt).toLocaleString('th-TH')],
    [],
    ['ภาพรวม', 'ค่า'],
    ['การเข้าชมสินค้า', summary.productViews],
    ['ผู้เข้าชมไม่ซ้ำ', summary.visitors],
    ['ออเดอร์สำเร็จ', summary.orders],
    ['จำนวนขาย', summary.unitsSold],
    ['ยอดขายรวม', summary.grossSales],
    ['รายได้สุทธิ', summary.netRevenue],
    [],
    [
      'สินค้า',
      'สถานะ',
      'Traffic',
      'ออเดอร์',
      'จำนวนขาย',
      'ยอดขายรวม',
      'รายได้สุทธิ',
      'Conversion (%)',
    ],
    ...products.map((product) => [
      product.title,
      product.status,
      product.product_views,
      product.orders,
      product.units_sold,
      product.gross_sales,
      product.net_revenue,
      product.visitors ? ((product.orders / product.visitors) * 100).toFixed(2) : 0,
    ]),
    [],
    ['สถิติคำค้นหา'],
    ['คำค้นหา', 'จำนวนครั้งค้นหา', 'การแสดงสินค้า', 'สินค้าที่ตรง', 'ค้นล่าสุด'],
    ...data.analytics.searchTerms.map((term) => [
      term.display_query,
      term.searches,
      term.product_impressions,
      term.matched_products,
      new Date(term.last_searched_at).toLocaleString('th-TH'),
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `e-kru-seller-analytics-${data.period.since.slice(0, 10)}-${data.period.until.slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: string;
  detail: string;
  icon: RemixiconComponentType;
  color: string;
  loading: boolean;
}) {
  return (
    <Card variant="outlined" sx={{ p: 2.5, height: 1 }}>
      {loading ? (
        <Skeleton variant="rounded" height={88} />
      ) : (
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box sx={{ p: 1.25, borderRadius: 2, color, bgcolor: 'action.hover', display: 'flex' }}>
            <Icon size={25} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography color="text.secondary" variant="body2">
              {label}
            </Typography>
            <Typography variant="h4" sx={{ my: 0.5 }} noWrap>
              {value}
            </Typography>
            <Typography color="text.secondary" variant="caption">
              {detail}
            </Typography>
          </Box>
        </Stack>
      )}
    </Card>
  );
}

const statusLabels: Record<string, string> = {
  draft: 'แบบร่าง',
  pending_review: 'รอตรวจ',
  published: 'เผยแพร่',
  rejected: 'ไม่ผ่าน',
  archived: 'ซ่อน',
};

export function MarketplaceSellerAnalyticsView() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<SellerAnalytics | null>(null);
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
        const response = await fetch(`/api/marketplace/seller/analytics?days=${days}`, {
          cache: 'no-store',
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? 'โหลดสถิติร้านค้าไม่สำเร็จ');
        setData(result);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'โหลดสถิติร้านค้าไม่สำเร็จ');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [days]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const daily = useMemo(() => data?.analytics.daily ?? [], [data]);
  const chartOptions = useChart({
    xaxis: {
      categories: daily.map((item) =>
        new Date(item.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
      ),
    },
    yaxis: { min: 0, forceNiceScale: true },
    legend: { show: true },
    tooltip: { shared: true, intersect: false },
  });
  const chartSeries = useMemo(
    () => [
      { name: 'Traffic', data: daily.map((item) => Number(item.product_views)) },
      { name: 'ออเดอร์', data: daily.map((item) => Number(item.orders)) },
      { name: 'จำนวนขาย', data: daily.map((item) => Number(item.units_sold)) },
    ],
    [daily]
  );

  const summary = data?.analytics.summary;
  const conversion = summary?.visitors
    ? ((summary.orders / summary.visitors) * 100).toFixed(2)
    : '0.00';
  const metrics = [
    {
      label: 'Traffic สินค้า',
      value: numberFormat.format(summary?.productViews ?? 0),
      detail: `${numberFormat.format(summary?.visitors ?? 0)} ผู้เข้าชมไม่ซ้ำ`,
      icon: RiEyeLine,
      color: 'primary.main',
    },
    {
      label: 'ออเดอร์สำเร็จ',
      value: numberFormat.format(summary?.orders ?? 0),
      detail: `${numberFormat.format(summary?.unitsSold ?? 0)} รายการขาย · ${conversion}% conversion`,
      icon: RiShoppingBag3Line,
      color: 'info.main',
    },
    {
      label: 'ยอดขายรวม',
      value: formatPrice(summary?.grossSales ?? 0),
      detail: 'มูลค่าก่อนหักค่าธรรมเนียม',
      icon: RiMoneyDollarCircleLine,
      color: 'success.main',
    },
    {
      label: 'รายได้สุทธิ',
      value: formatPrice(summary?.netRevenue ?? 0),
      detail: 'หลังหักค่าธรรมเนียมตามออเดอร์',
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
            <Typography variant="h3">สถิติร้านค้า</Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            ภาพรวมยอดขายและ Traffic ของสินค้าเฉพาะร้าน {data?.seller.display_name ?? 'ของคุณ'}
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
            <ToggleButton value={365}>1 ปี</ToggleButton>
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

      {error && <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>}
      {data?.setupRequired && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          กรุณารัน migration ล่าสุดเพื่อเปิดใช้งานสถิติร้านค้า
        </Alert>
      )}

      <Grid container spacing={2.5} sx={{ mt: 1 }}>
        {metrics.map((metric) => (
          <Grid key={metric.label} size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard {...metric} loading={loading} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 3 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card variant="outlined" sx={{ p: { xs: 2, md: 3 }, height: 1 }}>
            <Typography variant="h6">แนวโน้ม Traffic และยอดขาย</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              นับกิจกรรมล่าสุดของผู้เข้าชมที่ไม่ซ้ำในแต่ละสินค้า
            </Typography>
            {loading ? (
              <Skeleton variant="rounded" height={320} sx={{ mt: 3 }} />
            ) : (
              <Chart
                type="line"
                series={chartSeries}
                options={chartOptions}
                sx={{ height: 320, mt: 2 }}
              />
            )}
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card variant="outlined" sx={{ p: 3, height: 1 }}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <RiStore2Line size={24} />
              <Typography variant="h6">สถานะสินค้า</Typography>
            </Stack>
            <Stack spacing={2.25} sx={{ mt: 3 }}>
              <Box>
                <Typography color="text.secondary" variant="body2">สินค้าทั้งหมด</Typography>
                <Typography variant="h3">{numberFormat.format(summary?.products ?? 0)}</Typography>
              </Box>
              <Box>
                <Typography color="text.secondary" variant="body2">กำลังเผยแพร่</Typography>
                <Typography variant="h3" color="success.main">
                  {numberFormat.format(summary?.publishedProducts ?? 0)}
                </Typography>
              </Box>
              <Button component={RouterLink} href={paths.marketplace.seller} variant="outlined">
                จัดการสินค้า
              </Button>
            </Stack>
          </Card>
        </Grid>
      </Grid>

      <Card variant="outlined" sx={{ mt: 3, overflow: 'hidden' }}>
        <Box sx={{ px: { xs: 2, md: 3 }, pt: 3, pb: 2 }}>
          <Typography variant="h6">ผลงานแยกรายสินค้า</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            เรียงตามยอดขายและ Traffic ภายในช่วงเวลาที่เลือก
          </Typography>
        </Box>
        <TableContainer>
          <Table sx={{ minWidth: 980 }}>
            <TableHead>
              <TableRow>
                <TableCell>สินค้า</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell align="right">Traffic</TableCell>
                <TableCell align="right">ออเดอร์</TableCell>
                <TableCell align="right">จำนวนขาย</TableCell>
                <TableCell align="right">ยอดขาย</TableCell>
                <TableCell align="right">รายได้สุทธิ</TableCell>
                <TableCell align="right">Conversion</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={8}><Skeleton height={34} /></TableCell>
                  </TableRow>
                ))
              ) : data?.analytics.products.length ? (
                data.analytics.products.map((product) => {
                  const productConversion = product.visitors
                    ? (Number(product.orders) / Number(product.visitors)) * 100
                    : 0;
                  return (
                    <TableRow key={product.product_id} hover>
                      <TableCell sx={{ maxWidth: 320 }}>
                        <Tooltip title={product.title}>
                          <Typography
                            component={RouterLink}
                            href={paths.marketplace.product(product.product_id)}
                            variant="subtitle2"
                            color="text.primary"
                            noWrap
                            sx={{ display: 'block', textDecoration: 'none' }}
                          >
                            {product.title}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant="soft"
                          color={product.status === 'published' ? 'success' : 'default'}
                          label={statusLabels[product.status] ?? product.status}
                        />
                      </TableCell>
                      <TableCell align="right">{numberFormat.format(product.product_views)}</TableCell>
                      <TableCell align="right">{numberFormat.format(product.orders)}</TableCell>
                      <TableCell align="right">{numberFormat.format(product.units_sold)}</TableCell>
                      <TableCell align="right">{formatPrice(product.gross_sales)}</TableCell>
                      <TableCell align="right">{formatPrice(product.net_revenue)}</TableCell>
                      <TableCell align="right">{productConversion.toFixed(2)}%</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                    ยังไม่มีสินค้าในร้าน
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Card variant="outlined" sx={{ mt: 3, overflow: 'hidden' }}>
        <Box sx={{ px: { xs: 2, md: 3 }, pt: 3, pb: 2 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <RiSearchLine size={24} />
                <Typography variant="h6">สถิติคำค้นหา</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                คำที่ผู้ซื้อค้นหาแล้วสินค้าในร้านของคุณปรากฏในผลลัพธ์หน้าแรก
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                variant="soft"
                color="primary"
                label={`${numberFormat.format(data?.analytics.searchSummary.searches ?? 0)} ครั้งค้นหา`}
              />
              <Chip
                variant="soft"
                color="info"
                label={`${numberFormat.format(data?.analytics.searchSummary.uniqueTerms ?? 0)} คำค้นไม่ซ้ำ`}
              />
              <Chip
                variant="soft"
                color="success"
                label={`${numberFormat.format(data?.analytics.searchSummary.productImpressions ?? 0)} ครั้งที่สินค้าแสดง`}
              />
            </Stack>
          </Stack>
        </Box>
        <TableContainer>
          <Table sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell>คำค้นหา</TableCell>
                <TableCell align="right">จำนวนครั้งค้นหา</TableCell>
                <TableCell align="right">การแสดงสินค้า</TableCell>
                <TableCell align="right">สินค้าที่ตรง</TableCell>
                <TableCell align="right">ค้นล่าสุด</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={5}><Skeleton height={34} /></TableCell>
                  </TableRow>
                ))
              ) : data?.analytics.searchTerms.length ? (
                data.analytics.searchTerms.map((term) => (
                  <TableRow key={term.query} hover>
                    <TableCell>
                      <Typography variant="subtitle2">{term.display_query}</Typography>
                    </TableCell>
                    <TableCell align="right">{numberFormat.format(term.searches)}</TableCell>
                    <TableCell align="right">
                      {numberFormat.format(term.product_impressions)}
                    </TableCell>
                    <TableCell align="right">{numberFormat.format(term.matched_products)}</TableCell>
                    <TableCell align="right">
                      {new Date(term.last_searched_at).toLocaleString('th-TH', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 7 }}>
                    <Typography color="text.secondary">ยังไม่มีข้อมูลคำค้นหาในช่วงนี้</Typography>
                    <Typography variant="caption" color="text.disabled">
                      ระบบจะเริ่มสะสมข้อมูลเมื่อผู้ซื้อค้นหาแล้วพบสินค้าของร้าน
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Container>
  );
}
