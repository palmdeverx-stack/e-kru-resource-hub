'use client';

import type { MarketplaceSeller, MarketplaceProduct } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Pagination from '@mui/material/Pagination';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import {
  RiAddLine,
  RiEyeLine,
  RiEditLine,
  RiTimeLine,
  RiSearchLine,
  RiStore2Line,
  RiBookOpenLine,
  RiDeleteBinLine,
  RiFileList3Line,
  RiShieldStarLine,
  RiShieldStarFill,
  RiErrorWarningLine,
  RiVerifiedBadgeFill,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { getSeller, getProducts, formatPrice, deleteProduct } from '../../shared/api';
import {
  isSystemMarketplaceSeller,
  isSellerProfileVerified,
  getSellerProfileCompletion,
} from '../../shared/seller-completion';

type ProductFilter = 'all' | MarketplaceProduct['status'];

const PAGE_SIZE = 8;

export function MarketplaceSellerDashboardView() {
  const { user } = useAuthContext();
  const isSystemStore = user?.role === 'master_admin';
  const [seller, setSeller] = useState<MarketplaceSeller | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<MarketplaceProduct | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [productSearch, setProductSearch] = useState('');
  const [productPage, setProductPage] = useState(1);

  useEffect(() => {
    Promise.all([getSeller(), getProducts({ mine: true })])
      .then(([sellerResult, productResult]) => {
        setSeller(sellerResult.seller);
        setProducts(productResult.products);
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'ไม่สามารถโหลดข้อมูลร้านได้')
      )
      .finally(() => setLoading(false));
  }, []);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    setError('');
    try {
      await deleteProduct(deleting.id);
      setProducts((current) => current.filter((item) => item.id !== deleting.id));
      setDeleting(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'ลบสินค้าไม่สำเร็จ');
    } finally {
      setDeletingBusy(false);
    }
  };

  const sellerCompletion = seller ? getSellerProfileCompletion(seller) : 0;

  const productCounts = {
    all: products.length,
    published: products.filter((product) => product.status === 'published').length,
    pending_review: products.filter((product) => product.status === 'pending_review').length,
    draft: products.filter((product) => product.status === 'draft').length,
    rejected: products.filter((product) => product.status === 'rejected').length,
  };
  const normalizedSearch = productSearch.trim().toLowerCase();
  const filteredProducts = products.filter(
    (product) =>
      (productFilter === 'all' || product.status === productFilter) &&
      (!normalizedSearch ||
        product.title.toLowerCase().includes(normalizedSearch) ||
        product.title_en?.toLowerCase().includes(normalizedSearch) ||
        product.category?.toLowerCase().includes(normalizedSearch))
  );
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const visibleProducts = filteredProducts.slice(
    (productPage - 1) * PAGE_SIZE,
    productPage * PAGE_SIZE
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
                    color="#1565F5"
                    aria-label="ร้านค้าที่ผ่านการตรวจสอบ"
                  />
                )}
                {isSystemMarketplaceSeller(seller) && (
                  <RiShieldStarFill
                    size={26}
                    color="#7C3AED"
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
                <Chip color="success" size="medium" label="เปิดขายแล้ว" />
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
            </Tabs>

            <Divider />

            {visibleProducts.length ? (
              <Stack divider={<Divider flexItem />}>
                {visibleProducts.map((product) => {
                  const coverUrl =
                    product.images?.find((image) => image.is_cover)?.url ??
                    product.images?.[0]?.url ??
                    product.cover_url ??
                    undefined;
                  const canDelete = product.status === 'draft' || product.status === 'rejected';
                  return (
                    <Box
                      key={product.id}
                      sx={{
                        p: { xs: 2, md: 2.5 },
                        transition: 'background-color 160ms ease',
                        '&:hover': { bgcolor: 'background.neutral' },
                      }}
                    >
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={2}
                        alignItems={{ sm: 'center' }}
                      >
                        <Box
                          sx={{
                            width: { xs: 1, sm: 124 },
                            height: { xs: 180, sm: 92 },
                            flexShrink: 0,
                            display: 'grid',
                            borderRadius: 2,
                            placeItems: 'center',
                            bgcolor: 'primary.lighter',
                            backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        >
                          {!coverUrl && <RiBookOpenLine size={32} />}
                        </Box>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            flexWrap="wrap"
                            useFlexGap
                          >
                            <Typography variant="subtitle1">{product.title}</Typography>
                            <ProductStatusChip product={product} />
                          </Stack>
                          {!!product.title_en && (
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {product.title_en}
                            </Typography>
                          )}
                          <Stack
                            direction="row"
                            spacing={0.75}
                            alignItems="center"
                            flexWrap="wrap"
                            useFlexGap
                            sx={{ mt: 1 }}
                          >
                            {product.category && <Chip size="small" label={product.category} />}
                            {product.media_type?.name && (
                              <Chip
                                size="small"
                                variant="outlined"
                                label={product.media_type.name}
                              />
                            )}
                            <Typography variant="subtitle2" color="primary.main">
                              {formatPrice(Number(product.price))}
                            </Typography>
                          </Stack>
                          <Typography
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
                          </Typography>
                        </Box>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ flexShrink: 0, alignSelf: { sm: 'center' } }}
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
                            variant="outlined"
                            startIcon={<RiEditLine />}
                          >
                            {product.status === 'draft' ? 'ทำต่อ' : 'แก้ไข'}
                          </Button>
                          {canDelete && (
                            <Button
                              size="small"
                              color="error"
                              variant="text"
                              startIcon={<RiDeleteBinLine />}
                              onClick={() => setDeleting(product)}
                            >
                              ลบ
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                      {product.rejection_reason && (
                        <Alert severity="error" variant="outlined" sx={{ mt: 2 }}>
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
                  {products.length ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้า'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {products.length
                    ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ'
                    : 'เริ่มสร้างสินค้าแรกของร้านและส่งให้ผู้ดูแลตรวจสอบ'}
                </Typography>
                {products.length ? (
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

            {filteredProducts.length > PAGE_SIZE && (
              <>
                <Divider />
                <Stack alignItems="center" sx={{ py: 2.5 }}>
                  <Pagination
                    page={Math.min(productPage, pageCount)}
                    count={pageCount}
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
    </Container>
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
    return <Chip size="small" color="default" label="เก็บถาวร" variant="soft" />;
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
