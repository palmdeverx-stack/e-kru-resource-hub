'use client';

import type { MarketplaceSeller, MarketplaceProduct } from '../../shared/types';

import { useRef, useState, useEffect, useCallback } from 'react';

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

import {
  RiAddLine,
  RiEyeLine,
  RiEditLine,
  RiTimeLine,
  RiMore2Line,
  RiListCheck,
  RiEyeOffLine,
  RiSearchLine,
  RiStore2Line,
  RiBookOpenLine,
  RiDeleteBinLine,
  RiFileList3Line,
  RiLayoutGridLine,
  RiShieldStarLine,
  RiShieldStarFill,
  RiErrorWarningLine,
  RiVerifiedBadgeFill,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { MarketplaceProductCard } from '../../shared/product-card';
import {
  getSeller,
  getProducts,
  formatPrice,
  deleteProduct,
  setProductHidden,
} from '../../shared/api';
import {
  isSellerProfileVerified,
  isSystemMarketplaceSeller,
  getSellerProfileCompletion,
} from '../../shared/seller-completion';

type ProductFilter = 'all' | MarketplaceProduct['status'];
type ProductView = 'list' | 'grid';
type ProductCounts = Record<ProductFilter, number>;

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
  const theme = useTheme();
  const { user } = useAuthContext();
  const isSystemStore = user?.role === 'master_admin';
  const [seller, setSeller] = useState<MarketplaceSeller | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
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
  const [productTotal, setProductTotal] = useState(0);
  const [productPageCount, setProductPageCount] = useState(0);
  const [productCounts, setProductCounts] = useState<ProductCounts>(EMPTY_PRODUCT_COUNTS);
  const productRequestRef = useRef(0);

  useEffect(() => {
    getSeller()
      .then((sellerResult) => {
        setSeller(sellerResult.seller);
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'ไม่สามารถโหลดข้อมูลร้านได้')
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedProductSearch(productSearch.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [productSearch]);

  const loadProducts = useCallback(async () => {
    const requestId = productRequestRef.current + 1;
    productRequestRef.current = requestId;
    setProductsLoading(true);
    try {
      const result = await getProducts({
        mine: true,
        q: debouncedProductSearch || undefined,
        status: productFilter,
        page: productPage,
        limit: PAGE_SIZE,
      });
      if (requestId !== productRequestRef.current) return;
      const totalPages = result.pagination?.totalPages ?? 0;
      if (totalPages > 0 && productPage > totalPages) {
        setProductPage(totalPages);
        return;
      }
      setProducts(result.products);
      setProductTotal(result.pagination?.total ?? result.products.length);
      setProductPageCount(totalPages);
      setProductCounts(result.counts ?? EMPTY_PRODUCT_COUNTS);
    } catch (loadError) {
      if (requestId !== productRequestRef.current) return;
      setError(loadError instanceof Error ? loadError.message : 'ไม่สามารถโหลดรายการสินค้าได้');
    } finally {
      if (requestId === productRequestRef.current) setProductsLoading(false);
    }
  }, [debouncedProductSearch, productFilter, productPage]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    setError('');
    try {
      await deleteProduct(deleting.id);
      setDeleting(null);
      if (products.length === 1 && productPage > 1) {
        setProductPage((current) => current - 1);
      } else {
        await loadProducts();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'ลบสินค้าไม่สำเร็จ');
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
        visibilityError instanceof Error ? visibilityError.message : 'เปลี่ยนการแสดงสินค้าไม่สำเร็จ'
      );
    } finally {
      setVisibilityBusyId('');
    }
  };

  const sellerCompletion = seller ? getSellerProfileCompletion(seller) : 0;

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
      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {!seller ? (
        <Card sx={{ p: { xs: 3, md: 6 }, textAlign: 'center' }}>
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
            เปิดร้านบน E-KRU Marketplace
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', mt: 1, mb: 3 }}>
            ครู บุคคลทั่วไป และองค์กรสามารถสร้างร้าน แบ่งปันสื่อการสอน
            และจัดการผลงานได้จากพื้นที่เดียว
          </Typography>
          <Button component={RouterLink} href={paths.marketplace.sellerSetup} variant="contained">
            เริ่มเปิดร้าน
          </Button>
        </Card>
      ) : !isSystemStore && seller.status !== 'active' ? (
        <SellerReviewState seller={seller} />
      ) : (
        <Stack spacing={4}>
          {seller.profile_review_status === 'pending' && (
            <Alert severity="info">
              ข้อมูลร้านที่แก้ไขกำลังรอผู้ดูแลตรวจสอบ
              ระหว่างนี้หน้าร้านยังแสดงข้อมูลเดิมที่อนุมัติแล้ว
            </Alert>
          )}
          {seller.profile_review_status === 'rejected' && (
            <Alert severity="warning">
              ข้อมูลร้านที่แก้ไขไม่ผ่านการอนุมัติ:{' '}
              {seller.profile_rejection_reason || 'กรุณาตรวจสอบและแก้ไขข้อมูลแล้วส่งใหม่'}
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
                    aria-label="ร้านค้าที่ผ่านการตรวจสอบ"
                  />
                )}
                {isSystemMarketplaceSeller(seller) && (
                  <RiShieldStarFill
                    size={26}
                    color={theme.palette.primary.main}
                    aria-label="ร้านค้าระบบ E-KRU"
                  />
                )}
                {isSystemStore && (
                  <Chip
                    color="primary"
                    size="medium"
                    icon={<RiShieldStarLine />}
                    label="ร้านทางการ"
                  />
                )}
                {/* <Chip color="success" size="medium" label="เปิดขายแล้ว" /> */}
              </Stack>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {seller.bio || 'ร้านค้าบน E-KRU Marketplace'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                component={RouterLink}
                href={paths.marketplace.sellerProfileEdit}
                color="inherit"
              >
                แก้ไขร้าน
              </Button>
              <Button
                component={RouterLink}
                href="/dashboard/seller/products/new"
                variant="contained"
                startIcon={<RiAddLine />}
              >
                ลงสินค้าใหม่
              </Button>
            </Stack>
          </Stack>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <ProductMetricCard
                label="สินค้าทั้งหมด"
                value={productCounts.all}
                icon={<RiFileList3Line />}
                color="primary"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <ProductMetricCard
                label="เผยแพร่แล้ว"
                value={productCounts.published}
                icon={<RiCheckboxCircleLine />}
                color="success"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <ProductMetricCard
                label="รอตรวจสอบ"
                value={productCounts.pending_review}
                icon={<RiTimeLine />}
                color="warning"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <ProductMetricCard
                label="ต้องดำเนินการ"
                value={productCounts.draft + productCounts.rejected}
                icon={<RiErrorWarningLine />}
                color="error"
              />
            </Grid>
          </Grid>

          <Card variant="outlined" sx={{ overflow: 'hidden' }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ md: 'center' }}
              justifyContent="space-between"
              spacing={2}
              sx={{ p: { xs: 2.5, md: 3 } }}
            >
              <Box>
                <Typography variant="h4">สินค้าของฉัน</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  ค้นหา แก้ไข และติดตามสถานะสินค้าที่ส่งเข้า Marketplace
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
                  placeholder="ค้นหาชื่อหรือหมวดหมู่สินค้า"
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
                  aria-label="รูปแบบการแสดงสินค้า"
                  onChange={(_event, value: ProductView | null) => value && setProductView(value)}
                  sx={{
                    flexShrink: 0,
                    '& .MuiToggleButton-root': { gap: 0.75, px: 1.5 },
                  }}
                >
                  <ToggleButton value="list" aria-label="แสดงแบบรายการ">
                    <RiListCheck size={18} />
                    รายการ
                  </ToggleButton>
                  <ToggleButton value="grid" aria-label="แสดงแบบกริดที่ลูกค้าเห็น">
                    <RiLayoutGridLine size={18} />
                    กริดลูกค้า
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
              <Tab value="all" label={`ทั้งหมด ${productCounts.all}`} />
              <Tab value="published" label={`เผยแพร่ ${productCounts.published}`} />
              <Tab value="pending_review" label={`รอตรวจ ${productCounts.pending_review}`} />
              <Tab value="draft" label={`ฉบับร่าง ${productCounts.draft}`} />
              <Tab value="rejected" label={`ไม่ผ่าน ${productCounts.rejected}`} />
              <Tab value="archived" label={`ซ่อนแล้ว ${productCounts.archived}`} />
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
                  การ์ดสินค้าแสดงในรูปแบบเดียวกับที่ลูกค้าเห็นบน Marketplace
                  ส่วนสถานะและปุ่มจัดการจะแสดงเฉพาะในหน้าผู้ขายนี้
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
                              ขายแล้ว {product.purchase_count ?? 0} สิทธิ์
                            </Typography>
                          </Stack>
                          <SellerProductActions
                            compact
                            product={product}
                            visibilityBusy={visibilityBusyId === product.id}
                            onHide={() => setHiding(product)}
                            onRestore={() => void changeProductVisibility(product, false)}
                            onDelete={() => setDeleting(product)}
                          />
                          {product.rejection_reason && (
                            <Alert severity="error" variant="outlined">
                              ไม่ผ่านการอนุมัติ: {product.rejection_reason}
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
                              ราคาขาย
                            </Typography>
                            <Typography
                              variant="subtitle2"
                              color="primary.main"
                              sx={{ fontWeight: 800 }}
                            >
                              {formatPrice(Number(product.price))}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              ยอดขาย
                            </Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {(product.purchase_count ?? 0).toLocaleString('th-TH')} สิทธิ์
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
                          {new Intl.DateTimeFormat('th-TH', {
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
                          ไม่ผ่านการอนุมัติ: {product.rejection_reason}
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
                  {productCounts.all ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้า'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {productCounts.all
                    ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ'
                    : 'เริ่มสร้างสินค้าแรกของร้านและส่งให้ผู้ดูแลตรวจสอบ'}
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
                    ล้างตัวกรอง
                  </Button>
                ) : (
                  <Button
                    component={RouterLink}
                    href="/dashboard/seller/products/new"
                    variant="contained"
                    startIcon={<RiAddLine />}
                    sx={{ mt: 2 }}
                  >
                    ลงสินค้าชิ้นแรก
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
                    แสดง {(productPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(productPage * PAGE_SIZE, productTotal)} จาก {productTotal} รายการ
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
        <DialogTitle>ยืนยันการลบสินค้า</DialogTitle>
        <DialogContent>
          <Typography>ต้องการลบ “{deleting?.title}” หรือไม่? การลบไม่สามารถย้อนกลับได้</Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleting(null)}>
            ยกเลิก
          </Button>
          <Button color="error" variant="contained" loading={deletingBusy} onClick={confirmDelete}>
            ลบสินค้า
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(hiding)} onClose={() => setHiding(null)} fullWidth maxWidth="xs">
        <DialogTitle>ยืนยันการซ่อนสินค้า</DialogTitle>
        <DialogContent>
          <Typography>
            ต้องการซ่อน “{hiding?.title}” หรือไม่? ลูกค้าใหม่จะค้นหาและซื้อสินค้านี้ไม่ได้
            แต่ลูกค้าที่ชำระเงินแล้วจะยังเปิดดูและดาวน์โหลดได้จากรายการซื้อของฉันตามเดิม
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setHiding(null)}>
            ยกเลิก
          </Button>
          <Button
            color="warning"
            variant="contained"
            loading={Boolean(hiding && visibilityBusyId === hiding.id)}
            onClick={() => hiding && void changeProductVisibility(hiding, true)}
          >
            ซ่อนสินค้า
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

function SellerProductActions({
  product,
  compact = false,
  visibilityBusy,
  onHide,
  onRestore,
  onDelete,
}: {
  product: MarketplaceProduct;
  compact?: boolean;
  visibilityBusy: boolean;
  onHide: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
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
            ดูสินค้า
          </Button>
        )}
        <Button
          component={RouterLink}
          href={`/dashboard/seller/products/${product.id}/edit`}
          size="small"
          variant={product.status === 'archived' ? 'outlined' : 'contained'}
          startIcon={<RiEditLine />}
        >
          {product.status === 'draft' ? 'ทำต่อ' : 'แก้ไข'}
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
            ขายต่อ
          </Button>
        )}
        {hasSecondaryActions && (
          <IconButton
            size="small"
            aria-label={`คำสั่งเพิ่มเติมสำหรับ ${product.title}`}
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
            <RiEyeOffLine size={18} />
            ซ่อนสินค้า
          </MenuItem>
        )}
        {product.can_delete === true && (
          <MenuItem onClick={() => runMenuAction(onDelete)} sx={{ gap: 1.25, color: 'error.main' }}>
            <RiDeleteBinLine size={18} />
            ลบสินค้า
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
  if (product.status === 'published') {
    return <Chip size="small" color="success" label="เผยแพร่แล้ว" variant="soft" />;
  }
  if (product.status === 'rejected') {
    return <Chip size="small" color="error" label="ไม่ผ่าน" variant="soft" />;
  }
  if (product.status === 'pending_review') {
    return <Chip size="small" color="warning" label="รอตรวจสอบ" variant="soft" />;
  }
  if (product.status === 'archived') {
    return <Chip size="small" color="default" label="ซ่อนแล้ว" variant="soft" />;
  }
  return <Chip size="small" label="ฉบับร่าง" variant="soft" />;
}

function SellerReviewState({ seller }: { seller: MarketplaceSeller }) {
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
          ? 'แบบร่างการสมัครเปิดร้าน'
          : isRejected
            ? 'คำขอเปิดร้านไม่ผ่านการอนุมัติ'
            : isSuspended
              ? 'ร้านถูกระงับการใช้งาน'
              : 'ส่งคำขอเปิดร้านแล้ว'}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 620, mx: 'auto', mt: 1 }}>
        {isDraft
          ? 'ข้อมูลยังไม่ถูกส่งให้ผู้ดูแล กรุณากรอก Wizard ให้ครบแล้วส่งคำขอ'
          : isRejected
            ? seller.rejection_reason || 'กรุณาตรวจสอบและแก้ไขข้อมูลร้านก่อนส่งคำขอใหม่'
            : isSuspended
              ? 'กรุณาติดต่อผู้ดูแลระบบเพื่อสอบถามรายละเอียด'
              : 'ผู้ดูแลระบบกำลังตรวจสอบข้อมูลร้าน เมื่ออนุมัติแล้วคุณจึงจะสามารถสร้างและส่งสินค้าได้'}
      </Typography>
      {!isSuspended && (
        <Button
          component={RouterLink}
          href={paths.marketplace.sellerProfileEdit}
          variant={isRejected ? 'contained' : 'outlined'}
          color={isRejected ? 'error' : 'primary'}
          sx={{ mt: 3 }}
        >
          {isDraft ? 'กรอกข้อมูลสมัครต่อ' : isRejected ? 'แก้ไขและส่งคำขอใหม่' : 'ดูหรือแก้ไขคำขอ'}
        </Button>
      )}
    </Card>
  );
}
