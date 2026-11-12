'use client';

import type { MarketplaceSeller, MarketplaceProduct } from '../../shared/types';

import { memo, useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Menu from '@mui/material/Menu';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import { useTheme } from '@mui/material/styles';
import Pagination from '@mui/material/Pagination';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import ToggleButton from '@mui/material/ToggleButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { apiFetch as fetch } from 'src/lib/api-fetch';

import {
  RiAddLine,
  RiEyeLine,
  RiStarFill,
  RiEditLine,
  RiTimeLine,
  RiMore2Line,
  RiListCheck,
  RiEyeOffLine,
  RiSearchLine,
  RiStore2Line,
  RiWallet3Line,
  RiBookOpenLine,
  RiDeleteBinLine,
  RiFileList3Line,
  RiArrowRightLine,
  RiLayoutGridLine,
  RiShieldStarLine,
  RiShieldStarFill,
  RiShoppingBag3Line,
  RiErrorWarningLine,
  RiVerifiedBadgeFill,
  RiCheckboxCircleLine,
  RiMoneyDollarCircleLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { MarketplaceProductCard } from '../../shared/product-card';
import { useDashboardLocale } from '../../shared/use-dashboard-locale';
import { getSeller, getProducts, deleteProduct, setProductHidden } from '../../shared/api';
import {
  isSellerProfileVerified,
  isSystemMarketplaceSeller,
  getSellerProfileCompletion,
} from '../../shared/seller-completion';

type ProductFilter = 'all' | MarketplaceProduct['status'];
type ProductView = 'list' | 'grid';
type ProductCounts = Record<ProductFilter, number>;

type DashboardProductStat = {
  product_id: string;
  title: string;
  orders: number;
  units_sold: number;
  gross_sales: number;
  net_revenue: number;
};

type DashboardReview = {
  id: string;
  rating: number;
  comment: string | null;
  reviewer_name: string;
  updated_at: string;
  product: { id: string; title: string } | Array<{ id: string; title: string }>;
  reply: { id: string } | Array<{ id: string }> | null;
};

type DashboardAnalytics = {
  analytics: {
    summary: {
      orders: number;
      grossSales: number;
      netRevenue: number;
      unitsSold: number;
    };
    products: DashboardProductStat[];
  };
  recentReviews: DashboardReview[];
};

type DashboardFinance = {
  balance: {
    todayIncome: number;
    monthIncome: number;
    available: number;
    pending: number;
    processing: number;
  };
  schedule: { nextPayoutAt: string };
};

const PAGE_SIZE = 8;
const EMPTY_PRODUCT_COUNTS: ProductCounts = {
  all: 0,
  draft: 0,
  pending_review: 0,
  published: 0,
  rejected: 0,
  archived: 0,
};

export function MarketplaceSellerDashboardView() {
  const { tx, locale, money } = useDashboardLocale();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuthContext();
  const isSystemStore = user?.role === 'master_admin';
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<MarketplaceProduct | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [hiding, setHiding] = useState<MarketplaceProduct | null>(null);
  const [visibilityBusyId, setVisibilityBusyId] = useState('');
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [productView, setProductView] = useState<ProductView>('list');
  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const [productPage, setProductPage] = useState(1);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedProductSearch(productSearch.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [productSearch]);

  const sellerQuery = useQuery({
    queryKey: ['seller-summary', user?.id],
    queryFn: ({ signal }) => getSeller({ summary: true, signal }),
    enabled: !authLoading && !!user?.id,
    staleTime: 30_000,
  });
  const seller = sellerQuery.data?.seller ?? null;
  const loading = sellerQuery.isPending;
  const productsQuery = useQuery({
    queryKey: [
      'seller-dashboard-products',
      user?.id,
      debouncedProductSearch,
      productFilter,
      productPage,
    ],
    queryFn: ({ signal }) =>
      getProducts(
        {
          mine: true,
          cards: true,
          q: debouncedProductSearch || undefined,
          status: productFilter,
          page: productPage,
          limit: PAGE_SIZE,
        },
        { signal }
      ),
    enabled: !authLoading && !!user?.id,
    staleTime: 30_000,
  });
  const products = productsQuery.data?.products ?? [];
  const productsLoading = productsQuery.isPending;
  const productTotal = productsQuery.data?.pagination?.total ?? products.length;
  const productPageCount = productsQuery.data?.pagination?.totalPages ?? 0;
  const productCounts = productsQuery.data?.counts ?? EMPTY_PRODUCT_COUNTS;
  const loadProducts = () =>
    queryClient.invalidateQueries({ queryKey: ['seller-dashboard-products', user?.id] });
  useEffect(() => {
    if (productPageCount > 0 && productPage > productPageCount) setProductPage(productPageCount);
  }, [productPageCount, productPage]);

  // Both summaries start immediately; either one can render independently.
  const overviewEnabled = !authLoading && !!user?.id;
  const analyticsQuery = useQuery({
    queryKey: ['seller-dashboard-analytics', user?.id],
    enabled: overviewEnabled,
    queryFn: async ({ signal }): Promise<DashboardAnalytics> => {
      const response = await fetch('/api/marketplace/seller/analytics?days=30&summary=1', {
        cache: 'no-store',
        signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? tx('โหลดสถิติไม่สำเร็จ'));
      return result;
    },
    staleTime: 30_000,
    retry: 1,
  });
  const financeQuery = useQuery({
    queryKey: ['seller-dashboard-finance', user?.id],
    enabled: overviewEnabled,
    queryFn: async ({ signal }): Promise<DashboardFinance> => {
      const response = await fetch('/api/marketplace/seller/finance?summary=1', {
        cache: 'no-store',
        signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? tx('โหลดการเงินไม่สำเร็จ'));
      return result;
    },
    staleTime: 30_000,
    retry: 1,
  });
  const analytics = analyticsQuery.data ?? null;
  const finance = financeQuery.data ?? null;
  const overviewError = analyticsQuery.error?.message || financeQuery.error?.message || '';
  const loadError = error || sellerQuery.error?.message || productsQuery.error?.message || '';

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    setError('');
    try {
      await deleteProduct(deleting.id);
      setDeleting(null);
      if (products.length === 1 && productPage > 1) {
        setProductPage((current) => current - 1);
      }
      await loadProducts();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : tx('ลบสินค้าไม่สำเร็จ'));
    } finally {
      setDeletingBusy(false);
    }
  };

  const changeProductVisibility = async (product: MarketplaceProduct, hidden: boolean) => {
    setVisibilityBusyId(product.id);
    setError('');
    try {
      await setProductHidden(product.id, hidden);
      setHiding(null);
      await loadProducts();
    } catch (visibilityError) {
      setError(
        visibilityError instanceof Error
          ? visibilityError.message
          : tx('เปลี่ยนการแสดงสินค้าไม่สำเร็จ')
      );
    } finally {
      setVisibilityBusyId('');
    }
  };

  const sellerCompletion = useMemo(
    () => (seller ? getSellerProfileCompletion(seller) : 0),
    [seller]
  );

  const changeProductFilter = (value: ProductFilter) => {
    setProductFilter(value);
    setProductPage(1);
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: 480, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      {!!loadError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {loadError}
        </Alert>
      )}

      {!seller ? (
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
            <RiStore2Line size={40} />
          </Box>
          <Typography variant="h3" sx={{ mt: 3 }}>
            {tx('เปิดร้านบน E-KRU Marketplace')}
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', mt: 1, mb: 3 }}>
            {tx(
              'ครู บุคคลทั่วไป และองค์กรสามารถสร้างร้าน แบ่งปันสื่อการสอน และจัดการผลงานได้จากพื้นที่เดียว'
            )}
          </Typography>
          <Button component={RouterLink} href={paths.marketplace.sellerSetup} variant="contained">
            {tx('เริ่มเปิดร้าน')}
          </Button>
        </Card>
      ) : !isSystemStore && seller.status !== 'active' ? (
        <SellerReviewState seller={seller} />
      ) : (
        <Stack spacing={4}>
          {seller.profile_review_status === 'pending' && (
            <Alert severity="info">
              {tx(
                'ข้อมูลร้านที่แก้ไขกำลังรอผู้ดูแลตรวจสอบ ระหว่างนี้หน้าร้านยังแสดงข้อมูลเดิมที่อนุมัติแล้ว'
              )}
            </Alert>
          )}
          {seller.profile_review_status === 'rejected' && (
            <Alert severity="warning">
              {tx('ข้อมูลร้านที่แก้ไขไม่ผ่านการอนุมัติ:')}{' '}
              {seller.profile_rejection_reason || tx('กรุณาตรวจสอบและแก้ไขข้อมูลแล้วส่งใหม่')}
            </Alert>
          )}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
            spacing={2}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography component="h1" variant="h3">
                  {seller.display_name}
                </Typography>
                {isSellerProfileVerified(sellerCompletion) && (
                  <RiVerifiedBadgeFill
                    size={26}
                    color={theme.palette.primary.main}
                    aria-label={tx('ร้านค้าที่ผ่านการตรวจสอบ')}
                  />
                )}
                {isSystemMarketplaceSeller(seller) && (
                  <RiShieldStarFill
                    size={26}
                    color={theme.palette.primary.main}
                    aria-label={tx('ร้านค้าระบบ E-KRU')}
                  />
                )}
                {isSystemStore && (
                  <Chip
                    color="primary"
                    size="medium"
                    icon={<RiShieldStarLine />}
                    label={tx('ร้านทางการ')}
                  />
                )}
                {/* <Chip color="success" size="medium" label="เปิดขายแล้ว" /> */}
              </Stack>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {seller.bio || tx('ร้านค้าบน E-KRU Marketplace')}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                component={RouterLink}
                href={paths.marketplace.sellerProfileEdit}
                color="inherit"
              >
                {tx('แก้ไขร้าน')}
              </Button>
              <Button
                component={RouterLink}
                href="/dashboard/seller/products/new"
                variant="contained"
                startIcon={<RiAddLine />}
              >
                {tx('ลงสินค้าใหม่')}
              </Button>
            </Stack>
          </Stack>

          <SellerBusinessOverview
            analytics={analytics}
            finance={finance}
            analyticsLoading={analyticsQuery.isPending}
            financeLoading={financeQuery.isPending}
            error={overviewError}
            productCounts={productCounts}
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <ProductMetricCard
                label={tx('สินค้าทั้งหมด')}
                value={productCounts.all}
                icon={<RiFileList3Line />}
                color="primary"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <ProductMetricCard
                label={tx('เผยแพร่แล้ว')}
                value={productCounts.published}
                icon={<RiCheckboxCircleLine />}
                color="success"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <ProductMetricCard
                label={tx('รอตรวจสอบ')}
                value={productCounts.pending_review}
                icon={<RiTimeLine />}
                color="warning"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <ProductMetricCard
                label={tx('ต้องดำเนินการ')}
                value={productCounts.draft + productCounts.rejected}
                icon={<RiErrorWarningLine />}
                color="error"
              />
            </Grid>
          </Grid>

          <Card id="seller-products" variant="outlined" sx={{ overflow: 'hidden' }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ md: 'center' }}
              justifyContent="space-between"
              spacing={2}
              sx={{ p: { xs: 2.5, md: 3 } }}
            >
              <Box>
                <Typography variant="h4"> {tx('สินค้าของฉัน')} </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {tx('ค้นหา แก้ไข และติดตามสถานะสินค้าที่ส่งเข้าแพลตฟอร์มซื้อขาย')}
                </Typography>
              </Box>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ width: { xs: 1, md: 'auto' } }}
              >
                <TextField
                  size="small"
                  value={productSearch}
                  placeholder={tx('ค้นหาชื่อหรือหมวดหมู่สินค้า')}
                  onChange={(event) => {
                    setProductSearch(event.target.value);
                    setProductPage(1);
                  }}
                  sx={{ width: { xs: 1, md: 320 } }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <RiSearchLine size={18} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={productView}
                  aria-label={tx('รูปแบบการแสดงสินค้า')}
                  onChange={(_event, value: ProductView | null) => value && setProductView(value)}
                  sx={{
                    flexShrink: 0,
                    '& .MuiToggleButton-root': { gap: 0.75, px: 1.5 },
                  }}
                >
                  <ToggleButton value="list" aria-label={tx('แสดงแบบรายการ')}>
                    <RiListCheck size={18} /> {tx('รายการ')}
                  </ToggleButton>
                  <ToggleButton value="grid" aria-label={tx('แสดงแบบกริดที่ลูกค้าเห็น')}>
                    <RiLayoutGridLine size={18} /> {tx('กริดลูกค้า')}
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Stack>

            <Tabs
              value={productFilter}
              onChange={(_event, value: ProductFilter) => changeProductFilter(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ px: { xs: 1.5, md: 2.5 }, borderTop: '1px solid', borderColor: 'divider' }}
            >
              <Tab value="all" label={tx('ทั้งหมด {{v0}}', { v0: productCounts.all })} />
              <Tab
                value="published"
                label={tx('เผยแพร่ {{v0}}', { v0: productCounts.published })}
              />
              <Tab
                value="pending_review"
                label={tx('รอตรวจ {{v0}}', { v0: productCounts.pending_review })}
              />
              <Tab value="draft" label={tx('ฉบับร่าง {{v0}}', { v0: productCounts.draft })} />
              <Tab value="rejected" label={tx('ไม่ผ่าน {{v0}}', { v0: productCounts.rejected })} />
              <Tab value="archived" label={tx('ซ่อนแล้ว {{v0}}', { v0: productCounts.archived })} />
            </Tabs>

            <Divider />

            {productsLoading ? (
              <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
                <CircularProgress size={32} />
              </Box>
            ) : products.length && productView === 'grid' ? (
              <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.neutral' }}>
                <Alert
                  severity="info"
                  variant="outlined"
                  sx={{ mb: 2.5, bgcolor: 'background.paper' }}
                >
                  {tx(
                    'การ์ดสินค้าแสดงในรูปแบบเดียวกับที่ลูกค้าเห็นบน Marketplace ส่วนสถานะและปุ่มจัดการจะแสดงเฉพาะในหน้าผู้ขายนี้'
                  )}
                </Alert>
                <Grid container spacing={2.5}>
                  {products.map((product, index) => (
                    <Grid key={product.id} size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}>
                      <Stack sx={{ height: 1 }}>
                        <MarketplaceProductCard
                          product={product}
                          colorIndex={index}
                          productHref={
                            product.status === 'published'
                              ? `/product/${product.id}`
                              : `/dashboard/seller/products/${product.id}/edit`
                          }
                        />
                        <Stack
                          spacing={1.25}
                          sx={{
                            p: 1.5,
                            mt: 1,
                            border: '1px solid',
                            borderRadius: 2,
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            justifyContent="space-between"
                          >
                            <ProductStatusChip product={product} />
                            <Typography variant="caption" color="text.secondary">
                              {tx('ขายแล้ว')} {product.purchase_count ?? 0} {tx('สิทธิ์')}
                            </Typography>
                          </Stack>
                          <SellerProductActions
                            compact
                            product={product}
                            canViewBuyers={isSystemStore}
                            visibilityBusy={visibilityBusyId === product.id}
                            onHide={() => setHiding(product)}
                            onRestore={() => void changeProductVisibility(product, false)}
                            onDelete={() => setDeleting(product)}
                          />
                          {product.rejection_reason && (
                            <Alert severity="error" variant="outlined">
                              {tx('ไม่ผ่านการอนุมัติ:')} {product.rejection_reason}
                            </Alert>
                          )}
                        </Stack>
                      </Stack>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ) : products.length ? (
              <Stack spacing={1.5} sx={{ p: { xs: 1.5, md: 2 }, bgcolor: 'background.neutral' }}>
                {products.map((product) => {
                  const coverUrl =
                    product.images?.find((image) => image.is_cover)?.url ??
                    product.images?.[0]?.url ??
                    product.cover_url ??
                    undefined;
                  return (
                    <Box
                      key={product.id}
                      sx={{
                        p: { xs: 1.5, sm: 2 },
                        display: 'grid',
                        columnGap: { xs: 1.5, sm: 2 },
                        rowGap: { xs: 1.5, md: 1 },
                        border: '1px solid',
                        borderRadius: 2.5,
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        gridTemplateColumns: {
                          xs: '80px minmax(0, 1fr)',
                          sm: '104px minmax(0, 1fr)',
                          md: '112px minmax(0, 1fr) auto',
                        },
                        gridTemplateAreas: {
                          xs: '"image content" "actions actions" "notice notice"',
                          md: '"image content actions" "image notice notice"',
                        },
                        transition: 'border-color 160ms ease, box-shadow 160ms ease',
                        '&:hover': { borderColor: 'primary.light', boxShadow: 2 },
                      }}
                    >
                      <Box
                        sx={{
                          width: 1,
                          gridArea: 'image',
                          overflow: 'hidden',
                          aspectRatio: '1 / 1',
                          alignSelf: 'start',
                          display: 'grid',
                          borderRadius: 2,
                          placeItems: 'center',
                          color: 'primary.main',
                          bgcolor: 'primary.lighter',
                        }}
                      >
                        {coverUrl ? (
                          <Box
                            component="img"
                            src={coverUrl}
                            alt={product.title}
                            loading="lazy"
                            decoding="async"
                            sx={{ width: 1, height: 1, display: 'block', objectFit: 'cover' }}
                          />
                        ) : (
                          <RiBookOpenLine size={32} />
                        )}
                      </Box>

                      <Box sx={{ gridArea: 'content', minWidth: 0, alignSelf: 'center' }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          flexWrap="wrap"
                          useFlexGap
                        >
                          <Typography
                            variant="subtitle1"
                            sx={{
                              minWidth: 0,
                              fontWeight: 700,
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {product.title}
                          </Typography>
                          <ProductStatusChip product={product} />
                        </Stack>
                        {!![product.category, product.media_type?.name].filter(Boolean).length && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            noWrap
                            sx={{ mt: 0.5 }}
                          >
                            {[product.category, product.media_type?.name]
                              .filter(Boolean)
                              .join(' · ')}
                          </Typography>
                        )}
                        <Stack direction="row" spacing={2.5} alignItems="center" sx={{ mt: 1.25 }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              {tx('ราคาขาย')}
                            </Typography>
                            <Typography
                              variant="subtitle2"
                              color="primary.main"
                              sx={{ fontWeight: 800 }}
                            >
                              {money(Number(product.price))}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              {tx('ยอดขาย')}
                            </Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {(product.purchase_count ?? 0).toLocaleString(locale)} {tx('สิทธิ์')}
                            </Typography>
                          </Box>
                        </Stack>
                        {/* <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          sx={{ mt: 1 }}
                        >
                          สร้างเมื่อ{' '}
                          {new Intl.DateTimeFormat(locale, {
                            dateStyle: 'medium',
                            timeZone: 'Asia/Bangkok',
                          }).format(new Date(product.created_at))}
                        </Typography> */}
                      </Box>

                      <Box
                        sx={{
                          gridArea: 'actions',
                          alignSelf: { xs: 'start', md: 'center' },
                          justifySelf: { xs: 'stretch', md: 'end' },
                        }}
                      >
                        <SellerProductActions
                          product={product}
                          canViewBuyers={isSystemStore}
                          visibilityBusy={visibilityBusyId === product.id}
                          onHide={() => setHiding(product)}
                          onRestore={() => void changeProductVisibility(product, false)}
                          onDelete={() => setDeleting(product)}
                        />
                      </Box>

                      {product.rejection_reason && (
                        <Alert
                          severity="error"
                          variant="outlined"
                          sx={{ gridArea: 'notice', mt: { xs: 0, md: 0.5 } }}
                        >
                          {tx('ไม่ผ่านการอนุมัติ:')} {product.rejection_reason}
                        </Alert>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            ) : (
              <Box sx={{ py: 8, px: 3, textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 72,
                    height: 72,
                    mx: 'auto',
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 3,
                    color: 'text.secondary',
                    bgcolor: 'background.neutral',
                  }}
                >
                  <RiBookOpenLine size={34} />
                </Box>
                <Typography variant="h6" sx={{ mt: 2 }}>
                  {productCounts.all ? tx('ไม่พบสินค้าที่ค้นหา') : tx('ยังไม่มีสินค้า')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {productCounts.all
                    ? tx('ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ')
                    : tx('เริ่มสร้างสินค้าแรกของร้านและส่งให้ผู้ดูแลตรวจสอบ')}
                </Typography>
                {productCounts.all ? (
                  <Button
                    color="inherit"
                    sx={{ mt: 2 }}
                    onClick={() => {
                      setProductSearch('');
                      changeProductFilter('all');
                    }}
                  >
                    {tx('ล้างตัวกรอง')}
                  </Button>
                ) : (
                  <Button
                    component={RouterLink}
                    href="/dashboard/seller/products/new"
                    variant="contained"
                    startIcon={<RiAddLine />}
                    sx={{ mt: 2 }}
                  >
                    {tx('ลงสินค้าชิ้นแรก')}
                  </Button>
                )}
              </Box>
            )}

            {!productsLoading && productTotal > 0 && (
              <>
                <Divider />
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={1.5}
                  sx={{ px: { xs: 2, md: 3 }, py: 2.5 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {tx('แสดง')} {(productPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(productPage * PAGE_SIZE, productTotal)} {tx('จาก')} {productTotal}{' '}
                    {tx('รายการ')}
                  </Typography>
                  <Pagination
                    page={Math.min(productPage, Math.max(1, productPageCount))}
                    count={Math.max(1, productPageCount)}
                    color="primary"
                    onChange={(_event, value) => setProductPage(value)}
                  />
                </Stack>
              </>
            )}
          </Card>
        </Stack>
      )}

      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} fullWidth maxWidth="xs">
        <DialogTitle> {tx('ยืนยันการลบสินค้า')} </DialogTitle>
        <DialogContent>
          <Typography>
            {tx('ต้องการลบ “')} {deleting?.title} {tx('” หรือไม่? การลบไม่สามารถย้อนกลับได้')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleting(null)}>
            {tx('ยกเลิก')}
          </Button>
          <Button color="error" variant="contained" loading={deletingBusy} onClick={confirmDelete}>
            {tx('ลบสินค้า')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(hiding)} onClose={() => setHiding(null)} fullWidth maxWidth="xs">
        <DialogTitle> {tx('ยืนยันการซ่อนสินค้า')} </DialogTitle>
        <DialogContent>
          <Typography>
            {tx('ต้องการซ่อน “')} {hiding?.title}{' '}
            {tx(
              '” หรือไม่? ลูกค้าใหม่จะค้นหาและซื้อสินค้านี้ไม่ได้ แต่ลูกค้าที่ชำระเงินแล้วจะยังเปิดดูและดาวน์โหลดได้จากรายการซื้อของฉันตามเดิม'
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setHiding(null)}>
            {tx('ยกเลิก')}
          </Button>
          <Button
            color="warning"
            variant="contained"
            loading={Boolean(hiding && visibilityBusyId === hiding.id)}
            onClick={() => hiding && void changeProductVisibility(hiding, true)}
          >
            {tx('ซ่อนสินค้า')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

const SellerBusinessOverview = memo(function SellerBusinessOverview({
  analytics,
  finance,
  analyticsLoading,
  financeLoading,
  error,
  productCounts,
}: {
  analytics: DashboardAnalytics | null;
  finance: DashboardFinance | null;
  analyticsLoading: boolean;
  financeLoading: boolean;
  error: string;
  productCounts: ProductCounts;
}) {
  const { tx, locale, money } = useDashboardLocale();
  const summary = analytics?.analytics.summary;
  const topProducts = analytics?.analytics.products.slice(0, 3) ?? [];
  const reviews = analytics?.recentReviews?.slice(0, 3) ?? [];
  const pendingPayout =
    Number(finance?.balance.pending ?? 0) + Number(finance?.balance.processing ?? 0);
  const nextPayoutAt = finance?.schedule.nextPayoutAt
    ? new Date(finance.schedule.nextPayoutAt).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Bangkok',
      })
    : '-';
  const metrics = [
    {
      label: tx('ยอดขาย 30 วัน'),
      value: money(Number(summary?.grossSales ?? 0)),
      detail: tx('{{v0}} สิทธิ์ที่ขายได้', {
        v0: Number(summary?.unitsSold ?? 0).toLocaleString(locale),
      }),
      icon: <RiMoneyDollarCircleLine size={24} />,
      color: 'success' as const,
    },
    {
      label: tx('ออเดอร์สำเร็จ'),
      value: Number(summary?.orders ?? 0).toLocaleString(locale),
      detail: tx('ในช่วง 30 วันที่ผ่านมา'),
      icon: <RiShoppingBag3Line size={24} />,
      color: 'info' as const,
    },
    {
      label: tx('รายได้เดือนนี้'),
      value: money(Number(finance?.balance.monthIncome ?? 0)),
      detail: tx('วันนี้ {{v0}}', { v0: money(Number(finance?.balance.todayIncome ?? 0)) }),
      icon: <RiFileList3Line size={24} />,
      color: 'primary' as const,
    },
    {
      label: tx('ยอดพร้อมจ่าย'),
      value: money(Number(finance?.balance.available ?? 0)),
      detail: tx('รอบถัดไป {{v0}}', { v0: nextPayoutAt }),
      icon: <RiWallet3Line size={24} />,
      color: 'warning' as const,
    },
  ];

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={1}
      >
        <Box>
          <Typography variant="h4"> {tx('ภาพรวมธุรกิจ')} </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {tx('ยอดขาย รายได้ และสิ่งที่ต้องจัดการล่าสุดของร้าน')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            component={RouterLink}
            href={paths.marketplace.sellerAnalytics}
            size="small"
            endIcon={<RiArrowRightLine />}
          >
            {tx('ดูสถิติ')}
          </Button>
          <Button
            component={RouterLink}
            href={paths.marketplace.sellerFinance}
            size="small"
            variant="outlined"
          >
            {tx('ดูการเงิน')}
          </Button>
        </Stack>
      </Stack>

      {!!error && (
        <Alert severity="warning">
          {tx('โหลดภาพรวมบางส่วนไม่สำเร็จ:')} {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        {metrics.map((metric, index) => (
          <Grid key={metric.label} size={{ xs: 12, sm: 6, lg: 3 }}>
            <DashboardMetricCard
              {...metric}
              loading={index < 2 ? analyticsLoading : financeLoading}
            />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card variant="outlined" sx={{ p: { xs: 2.25, md: 2.75 }, height: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6"> {tx('สินค้าขายดี')} </Typography>
                <Typography variant="caption" color="text.secondary">
                  {tx('เรียงจากยอดขายในช่วง 30 วัน')}
                </Typography>
              </Box>
              <Button component={RouterLink} href={paths.marketplace.sellerAnalytics} size="small">
                {tx('ดูทั้งหมด')}
              </Button>
            </Stack>
            <Stack spacing={1.25} sx={{ mt: 2 }}>
              {analyticsLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} variant="rounded" height={56} />
                ))
              ) : topProducts.length ? (
                topProducts.map((product, index) => (
                  <Stack
                    key={product.product_id}
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    sx={{ p: 1.25, borderRadius: 2, bgcolor: 'background.neutral' }}
                  >
                    <Box
                      sx={{
                        width: 30,
                        height: 30,
                        flexShrink: 0,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 1.5,
                        fontWeight: 800,
                        color: 'primary.main',
                        bgcolor: 'primary.lighter',
                      }}
                    >
                      {index + 1}
                    </Box>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="subtitle2" noWrap>
                        {product.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {Number(product.orders).toLocaleString(locale)} {tx('ออเดอร์ ·')}{' '}
                        {Number(product.units_sold).toLocaleString(locale)} {tx('สิทธิ์')}
                      </Typography>
                    </Box>
                    <Typography variant="subtitle2" color="success.main" sx={{ flexShrink: 0 }}>
                      {money(Number(product.gross_sales))}
                    </Typography>
                  </Stack>
                ))
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 3, textAlign: 'center' }}
                >
                  {tx('ยังไม่มียอดขายในช่วง 30 วัน')}
                </Typography>
              )}
            </Stack>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7, lg: 4 }}>
          <Card variant="outlined" sx={{ p: { xs: 2.25, md: 2.75 }, height: 1 }}>
            <Typography variant="h6"> {tx('รีวิวล่าสุด')} </Typography>
            <Typography variant="caption" color="text.secondary">
              {tx('เสียงตอบรับล่าสุดจากผู้ซื้อ')}
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              {analyticsLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} variant="rounded" height={64} />
                ))
              ) : reviews.length ? (
                reviews.map((review) => {
                  const product = Array.isArray(review.product)
                    ? review.product[0]
                    : review.product;
                  const hasReply = Array.isArray(review.reply)
                    ? review.reply.length > 0
                    : Boolean(review.reply);
                  return (
                    <Box
                      key={review.id}
                      sx={{ pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
                    >
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography variant="subtitle2" noWrap sx={{ minWidth: 0 }}>
                          {product?.title ?? tx('สินค้า')}
                        </Typography>
                        <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                          {Array.from({ length: 5 }).map((_, index) => (
                            <RiStarFill
                              key={index}
                              size={14}
                              color={index < review.rating ? '#FFAB00' : '#DFE3E8'}
                            />
                          ))}
                        </Stack>
                      </Stack>
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5 }}>
                        {review.comment || tx('ให้คะแนนโดยไม่มีข้อความ')}
                      </Typography>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ mt: 0.5 }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {review.reviewer_name}
                        </Typography>
                        {product && (
                          <Button
                            component={RouterLink}
                            href={paths.marketplace.product(product.id)}
                            size="small"
                            color={hasReply ? 'inherit' : 'primary'}
                            sx={{ minWidth: 0, p: 0.25 }}
                          >
                            {hasReply ? tx('ตอบแล้ว') : tx('ดูและตอบกลับ')}
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  );
                })
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 3, textAlign: 'center' }}
                >
                  {tx('ยังไม่มีรีวิวจากผู้ซื้อ')}
                </Typography>
              )}
            </Stack>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5, lg: 3 }}>
          <Card variant="outlined" sx={{ p: { xs: 2.25, md: 2.75 }, height: 1 }}>
            <Typography variant="h6"> {tx('สิ่งที่ต้องจัดการ')} </Typography>
            <Typography variant="caption" color="text.secondary">
              {tx('รายการที่อาจกระทบการขาย')}
            </Typography>
            <Stack spacing={1.25} sx={{ mt: 2 }}>
              <TaskRow label={tx('สินค้าไม่ผ่าน')} value={productCounts.rejected} color="error" />
              <TaskRow
                label={tx('ฉบับร่างที่ยังไม่เสร็จ')}
                value={productCounts.draft}
                color="warning"
              />
              <TaskRow
                label={tx('กำลังรอตรวจ')}
                value={productCounts.pending_review}
                color="info"
              />
              <Divider />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {tx('ยอดกำลังรอรับ')}
                </Typography>
                <Typography variant="h5" sx={{ mt: 0.25 }}>
                  {financeLoading ? <Skeleton width={100} /> : money(pendingPayout)}
                </Typography>
              </Box>
              <Button component="a" href="#seller-products" variant="outlined" fullWidth>
                {tx('จัดการสินค้า')}
              </Button>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
});

function DashboardMetricCard({
  label,
  value,
  detail,
  icon,
  color,
  loading,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  color: 'primary' | 'success' | 'warning' | 'info';
  loading: boolean;
}) {
  return (
    <Card variant="outlined" sx={{ p: 2.5, height: 1 }}>
      <Stack direction="row" spacing={1.75} alignItems="center">
        <Box
          sx={{
            width: 48,
            height: 48,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 2,
            color: `${color}.main`,
            bgcolor: `${color}.lighter`,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          {loading ? (
            <Skeleton width={110} height={34} />
          ) : (
            <Typography variant="h4">{value}</Typography>
          )}
          <Typography variant="caption" color="text.secondary" noWrap>
            {detail}
          </Typography>
        </Box>
      </Stack>
    </Card>
  );
}

function TaskRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'error' | 'warning' | 'info';
}) {
  const { locale } = useDashboardLocale();
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={{ p: 1.25, borderRadius: 2, bgcolor: `${color}.lighter` }}
    >
      <Typography variant="body2">{label}</Typography>
      <Chip size="small" color={color} label={value.toLocaleString(locale)} />
    </Stack>
  );
}

function SellerProductActions({
  product,
  compact = false,
  canViewBuyers,
  visibilityBusy,
  onHide,
  onRestore,
  onDelete,
}: {
  product: MarketplaceProduct;
  compact?: boolean;
  canViewBuyers: boolean;
  visibilityBusy: boolean;
  onHide: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const { tx } = useDashboardLocale();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const closeMenu = () => setMenuAnchor(null);
  const runMenuAction = (action: () => void) => {
    closeMenu();
    action();
  };
  const hasSecondaryActions = product.can_hide === true || product.can_delete === true;

  return (
    <>
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{
          flexShrink: 0,
          alignSelf: { sm: 'center' },
          width: compact ? 1 : { xs: 1, md: 'auto' },
          justifyContent: { xs: 'flex-start', md: 'flex-end' },
        }}
      >
        {product.status === 'published' && (
          <Button
            component="a"
            href={`/product/${product.id}`}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            color="inherit"
            startIcon={<RiEyeLine />}
          >
            {tx('ดูสินค้า')}
          </Button>
        )}
        {canViewBuyers && (product.purchase_count ?? 0) > 0 && (
          <Button
            component={RouterLink}
            href={`${paths.marketplace.sellerFinance}?tab=sales&productId=${encodeURIComponent(product.id)}`}
            size="small"
            color="primary"
            variant="outlined"
            startIcon={<RiShoppingBag3Line />}
          >
            {tx('ดูผู้ซื้อ')}
          </Button>
        )}
        <Button
          component={RouterLink}
          href={`/dashboard/seller/products/${product.id}/edit`}
          size="small"
          variant={product.status === 'archived' ? 'outlined' : 'contained'}
          startIcon={<RiEditLine />}
        >
          {product.status === 'draft' ? tx('ทำต่อ') : tx('แก้ไข')}
        </Button>
        {product.status === 'archived' && (
          <Button
            size="small"
            color="success"
            variant="contained"
            loading={visibilityBusy}
            startIcon={<RiEyeLine />}
            onClick={onRestore}
          >
            {tx('ขายต่อ')}
          </Button>
        )}
        {hasSecondaryActions && (
          <IconButton
            size="small"
            aria-label={tx('คำสั่งเพิ่มเติมสำหรับ {{v0}}', { v0: product.title })}
            aria-haspopup="menu"
            aria-expanded={Boolean(menuAnchor)}
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            sx={{ border: '1px solid', borderColor: 'divider' }}
          >
            <RiMore2Line size={18} />
          </IconButton>
        )}
      </Stack>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        {product.can_hide === true && (
          <MenuItem onClick={() => runMenuAction(onHide)} sx={{ gap: 1.25, color: 'warning.dark' }}>
            <RiEyeOffLine size={18} /> {tx('ซ่อนสินค้า')}
          </MenuItem>
        )}
        {product.can_delete === true && (
          <MenuItem onClick={() => runMenuAction(onDelete)} sx={{ gap: 1.25, color: 'error.main' }}>
            <RiDeleteBinLine size={18} /> {tx('ลบสินค้า')}
          </MenuItem>
        )}
      </Menu>
    </>
  );
}

function ProductMetricCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'primary' | 'success' | 'warning' | 'error';
}) {
  return (
    <Card variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, height: 1 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 2,
            color: `${color}.main`,
            bgcolor: `${color}.lighter`,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4">{value}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {label}
          </Typography>
        </Box>
      </Stack>
    </Card>
  );
}

function ProductStatusChip({ product }: { product: MarketplaceProduct }) {
  const { tx } = useDashboardLocale();
  if (product.status === 'published') {
    return <Chip size="small" color="success" label={tx('เผยแพร่แล้ว')} variant="soft" />;
  }
  if (product.status === 'rejected') {
    return <Chip size="small" color="error" label={tx('ไม่ผ่าน')} variant="soft" />;
  }
  if (product.status === 'pending_review') {
    return <Chip size="small" color="warning" label={tx('รอตรวจสอบ')} variant="soft" />;
  }
  if (product.status === 'archived') {
    return <Chip size="small" color="default" label={tx('ซ่อนแล้ว')} variant="soft" />;
  }
  return <Chip size="small" label={tx('ฉบับร่าง')} variant="soft" />;
}

function SellerReviewState({ seller }: { seller: MarketplaceSeller }) {
  const { tx } = useDashboardLocale();
  const isRejected = seller.status === 'rejected';
  const isSuspended = seller.status === 'suspended';
  const isDraft = seller.status === 'draft';

  return (
    <Card sx={{ p: { xs: 3, md: 6 }, textAlign: 'center' }}>
      <Box
        sx={{
          width: 80,
          height: 80,
          mx: 'auto',
          display: 'grid',
          borderRadius: 3,
          placeItems: 'center',
          color: isRejected || isSuspended ? 'error.main' : 'warning.main',
          bgcolor: isRejected || isSuspended ? 'error.lighter' : 'warning.lighter',
        }}
      >
        <RiStore2Line size={40} />
      </Box>
      <Typography variant="h3" sx={{ mt: 3 }}>
        {isDraft
          ? tx('แบบร่างการสมัครเปิดร้าน')
          : isRejected
            ? tx('คำขอเปิดร้านไม่ผ่านการอนุมัติ')
            : isSuspended
              ? tx('ร้านถูกระงับการใช้งาน')
              : tx('ส่งคำขอเปิดร้านแล้ว')}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 620, mx: 'auto', mt: 1 }}>
        {isDraft
          ? tx('ข้อมูลยังไม่ได้ถูกส่งให้ผู้ดูแลตรวจสอบ กรุณากรอกข้อมูลให้ครบถ้วน แล้วส่งคำขอ')
          : isRejected
            ? seller.rejection_reason || tx('กรุณาตรวจสอบและแก้ไขข้อมูลร้านก่อนส่งคำขอใหม่')
            : isSuspended
              ? tx('กรุณาติดต่อผู้ดูแลระบบเพื่อสอบถามรายละเอียด')
              : tx(
                  'ผู้ดูแลระบบกำลังตรวจสอบข้อมูลร้าน เมื่ออนุมัติแล้วคุณจึงจะสามารถสร้างและส่งสินค้าได้'
                )}
      </Typography>
      {!isSuspended && (
        <Button
          component={RouterLink}
          href={paths.marketplace.sellerProfileEdit}
          variant={isRejected ? 'contained' : 'outlined'}
          color={isRejected ? 'error' : 'primary'}
          sx={{ mt: 3 }}
        >
          {isDraft
            ? tx('กรอกข้อมูลสมัครต่อ')
            : isRejected
              ? tx('แก้ไขและส่งคำขอใหม่')
              : tx('ดูหรือแก้ไขคำขอ')}
        </Button>
      )}
    </Card>
  );
}
