'use client';

import type { MarketplaceProduct } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Rating from '@mui/material/Rating';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useRouter, usePathname } from 'src/routes/hooks';

import { useTranslate } from 'src/locales';
import { SCHOOL_FEATURES } from 'src/lib/school-subscription-config';

import {
  RiAddLine,
  RiEyeLine,
  RiFileLine,
  RiStarLine,
  RiHeartLine,
  RiBook2Line,
  RiBookmarkLine,
  RiBookOpenLine,
  RiPriceTag3Line,
  RiArrowLeftLine,
  RiShieldCheckLine,
  RiShareForwardLine,
  RiShoppingBag3Line,
  RiGraduationCapLine,
  RiDownloadCloud2Line,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { findSampleProduct } from '../../shared/constants';
import { useMarketplaceCart } from '../../cart/cart-context';
import { MarketplaceSellerLink } from '../../shared/seller-link';
import {
  stripHtml,
  getProduct,
  getProducts,
  formatPrice,
  recordProductView,
  saveProductReview,
  getLocalizedProduct,
  getProductPreference,
  getProductPreviewFiles,
  updateProductCollection,
} from '../../shared/api';

const VISITOR_STORAGE_KEY = 'ekru_marketplace_visitor_id';
const featureLabels = new Map<string, string>(
  SCHOOL_FEATURES.map((feature) => [feature.key, feature.label])
);

export function MarketplaceProductDetailView({
  productId,
  modalMode = false,
  onSelectProduct,
}: {
  productId: string;
  modalMode?: boolean;
  onSelectProduct?: (product: MarketplaceProduct) => void;
}) {
  const { currentLang } = useTranslate();
  const router = useRouter();
  const pathname = usePathname();
  const { authenticated } = useAuthContext();
  const { items, addItem } = useMarketplaceCart();
  const [product, setProduct] = useState<MarketplaceProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const [reviewRating, setReviewRating] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewEditing, setReviewEditing] = useState(true);
  const [reviewError, setReviewError] = useState('');
  const [reviewSaved, setReviewSaved] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [saved, setSaved] = useState(false);
  const [collectionSaving, setCollectionSaving] = useState(false);
  const [sellerProducts, setSellerProducts] = useState<MarketplaceProduct[]>([]);
  const [sellerProductsLoading, setSellerProductsLoading] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<MarketplaceProduct[]>([]);
  const [relatedProductsLoading, setRelatedProductsLoading] = useState(false);

  useEffect(() => {
    setActiveImageIndex(0);
    setPreviewError('');
    const sample = findSampleProduct(productId);
    if (sample) {
      setProduct(sample);
      setLoading(false);
      return;
    }
    getProduct(productId)
      .then((result) => {
        const myReview = result.product.engagement?.myReview ?? null;
        setProduct(result.product);
        setReviewRating(myReview?.rating ?? null);
        setReviewComment(myReview?.comment ?? '');
        setReviewEditing(!myReview);

        let visitorId = window.localStorage.getItem(VISITOR_STORAGE_KEY);
        if (!visitorId) {
          visitorId = window.crypto.randomUUID();
          window.localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
        }
        recordProductView(productId, visitorId)
          .then(({ views }) =>
            setProduct((current) =>
              current?.engagement
                ? { ...current, engagement: { ...current.engagement, views } }
                : current
            )
          )
          .catch(() => undefined);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    if (!authenticated || !product?.id || product.id.startsWith('sample-')) {
      setFavorite(false);
      setSaved(false);
      return undefined;
    }

    let active = true;
    getProductPreference(product.id)
      .then(({ preference }) => {
        if (!active) return;
        setFavorite(preference.favorite);
        setSaved(preference.bookmark);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [authenticated, product?.id]);

  useEffect(() => {
    if (!modalMode || !product?.seller_id) return undefined;
    let active = true;
    setSellerProductsLoading(true);

    getProducts({ sellerId: product.seller_id, page: 1, limit: 5 })
      .then(({ products }) => {
        if (active) {
          setSellerProducts(products.filter((item) => item.id !== product.id).slice(0, 4));
        }
      })
      .catch(() => {
        if (active) setSellerProducts([]);
      })
      .finally(() => {
        if (active) setSellerProductsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [modalMode, product?.id, product?.seller_id]);

  useEffect(() => {
    if (!modalMode || !product?.id || !product.category) return undefined;
    let active = true;
    setRelatedProductsLoading(true);

    getProducts({ category: product.category, page: 1, limit: 12 })
      .then(({ products }) => {
        if (active) {
          setRelatedProducts(products.filter((item) => item.id !== product.id));
        }
      })
      .catch(() => {
        if (active) setRelatedProducts([]);
      })
      .finally(() => {
        if (active) setRelatedProductsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [modalMode, product?.category, product?.id]);

  if (loading) {
    return (
      <Box sx={{ minHeight: 500, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!product) {
    return (
      <Container maxWidth="md" sx={{ py: 10 }}>
        <Alert severity="warning">ไม่พบสินค้านี้ หรือสินค้าถูกนำออกจาก Marketplace</Alert>
        <Button
          component={RouterLink}
          href="/products"
          startIcon={<RiArrowLeftLine />}
          sx={{ mt: 3 }}
        >
          กลับไปเลือกสินค้า
        </Button>
      </Container>
    );
  }

  const content = getLocalizedProduct(product, currentLang.value);

  const handleAdd = () => {
    addItem(product);
    setAdded(true);
  };

  const handleReviewSubmit = async () => {
    if (!reviewRating) {
      setReviewError('กรุณาเลือกคะแนนดาว');
      return;
    }
    setReviewSaving(true);
    setReviewError('');
    setReviewSaved('');
    try {
      const result = await saveProductReview(product.id, reviewRating, reviewComment);
      setProduct((current) => (current ? { ...current, engagement: result.engagement } : current));
      setReviewRating(result.engagement.myReview?.rating ?? reviewRating);
      setReviewComment(result.engagement.myReview?.comment ?? '');
      setReviewEditing(false);
      setReviewSaved(result.message);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'ไม่สามารถบันทึกรีวิวได้');
    } finally {
      setReviewSaving(false);
    }
  };

  const handleEditReview = () => {
    setReviewRating(engagement.myReview?.rating ?? null);
    setReviewComment(engagement.myReview?.comment ?? '');
    setReviewError('');
    setReviewSaved('');
    setReviewEditing(true);
  };

  const handleCancelReviewEdit = () => {
    setReviewRating(engagement.myReview?.rating ?? null);
    setReviewComment(engagement.myReview?.comment ?? '');
    setReviewError('');
    setReviewSaved('');
    setReviewEditing(false);
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const { files } = await getProductPreviewFiles(product.id);
      const preview = files.find((file) => file.url);
      if (!preview?.url) {
        setPreviewError('สินค้านี้ยังไม่มีไฟล์ตัวอย่าง');
        return;
      }
      window.open(preview.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'ไม่สามารถเปิดตัวอย่างได้');
    } finally {
      setPreviewLoading(false);
    }
  };

  const galleryImages = [...(product.images ?? [])].sort(
    (left, right) =>
      Number(right.is_cover) - Number(left.is_cover) || left.position - right.position
  );
  const coverUrl =
    galleryImages[activeImageIndex]?.url ?? product.cover_url ?? galleryImages[0]?.url ?? undefined;
  const engagement = product.engagement ?? {
    views: 0,
    purchases: 0,
    downloads: 0,
    reviewCount: 0,
    averageRating: 0,
    reviews: [],
    canReview: false,
    myReview: null,
  };
  const isInCart = added || items.some((item) => item.product.id === product.id);
  const purchaseAccess = product.purchase_access;
  const purchaseUnavailable = purchaseAccess?.canPurchase === false;
  const activeSubscription =
    product.resource_type === 'feature_unlock' &&
    purchaseUnavailable &&
    purchaseAccess?.accessExpiresAt;
  const addButtonLabel = activeSubscription
    ? `ใช้งานถึง ${new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(
        new Date(activeSubscription)
      )}`
    : purchaseUnavailable
      ? purchaseAccess?.hasPurchased
        ? 'ซื้อสินค้านี้แล้ว'
        : 'ไม่สามารถซื้อด้วยบัญชีนี้'
      : isInCart
        ? 'อยู่ในตะกร้าแล้ว'
        : 'เพิ่มลงตะกร้า';
  const sellerProductIds = new Set(sellerProducts.map((item) => item.id));
  const visibleRelatedProducts = relatedProducts
    .filter((item) => !sellerProductIds.has(item.id))
    .slice(0, 4);
  const sellerId =
    product.seller?.id && /^[0-9a-f-]{36}$/i.test(product.seller.id) ? product.seller.id : '';
  const storeIdentifier = product.seller?.slug || sellerId;
  const storeHref = storeIdentifier
    ? pathname.startsWith('/dashboard')
      ? `/dashboard/store/${storeIdentifier}`
      : `/store/${storeIdentifier}`
    : '';

  const sellerAvatar = (size: number) => (
    <MarketplaceSellerLink seller={product.seller} avatarSize={size} showName={false} />
  );
  const sellerName = (variant: 'subtitle1' | 'h4' = 'subtitle1') => (
    <MarketplaceSellerLink
      seller={product.seller}
      showAvatar={false}
      nameVariant={variant}
      nameSx={{ fontWeight: variant === 'h4' ? 700 : 600 }}
    />
  );
  const handleCollectionChange = async (
    collectionType: 'favorite' | 'bookmark',
    currentValue: boolean
  ) => {
    if (!authenticated) {
      router.push(`${paths.auth.jwt.signIn}?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }

    const nextValue = !currentValue;
    const setValue = collectionType === 'favorite' ? setFavorite : setSaved;
    setValue(nextValue);
    setCollectionSaving(true);
    try {
      await updateProductCollection(product.id, collectionType, nextValue);
      window.dispatchEvent(new Event('marketplace-collections-changed'));
    } catch {
      setValue(currentValue);
    } finally {
      setCollectionSaving(false);
    }
  };

  if (modalMode) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 7 } }}>
        <Stack spacing={{ xs: 3, md: 4 }}>
          <Typography component="h1" variant="h3" sx={{ pr: 7 }}>
            {content.title}
          </Typography>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={2.5}
            sx={{
              top: 0,
              zIndex: 4,
              py: 1.5,
              position: 'sticky',
              bgcolor: 'rgba(255,255,255,0.94)',
              borderBottom: '1px solid',
              borderColor: 'divider',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              {sellerAvatar(50)}
              <Box>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  {sellerName()}
                  <RiShieldCheckLine size={18} color="#1565F5" />
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Rating size="small" value={engagement.averageRating} precision={0.1} readOnly />
                  <Typography variant="caption" color="text.secondary">
                    {engagement.reviewCount
                      ? `${engagement.averageRating.toFixed(1)} · ${engagement.reviewCount} รีวิว`
                      : 'สินค้าใหม่'}
                  </Typography>
                </Stack>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton
                aria-label={favorite ? 'เลิกถูกใจสินค้า' : 'ถูกใจสินค้า'}
                disabled={collectionSaving}
                onClick={() => handleCollectionChange('favorite', favorite)}
                sx={{
                  border: '1px solid',
                  borderColor: favorite ? 'primary.main' : 'divider',
                  color: favorite ? 'primary.main' : 'text.primary',
                }}
              >
                <RiHeartLine />
              </IconButton>
              <IconButton
                aria-label={saved ? 'นำออกจากรายการที่บันทึก' : 'บันทึกสินค้า'}
                disabled={collectionSaving}
                onClick={() => handleCollectionChange('bookmark', saved)}
                sx={{
                  border: '1px solid',
                  borderColor: saved ? 'primary.main' : 'divider',
                  color: saved ? 'primary.main' : 'text.primary',
                }}
              >
                <RiBookmarkLine />
              </IconButton>
              <IconButton
                aria-label="แชร์สินค้า"
                onClick={() => {
                  if (navigator.share) {
                    navigator
                      .share({ title: content.title, url: window.location.href })
                      .catch(() => undefined);
                  } else {
                    navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
                  }
                }}
                sx={{ border: '1px solid', borderColor: 'divider' }}
              >
                <RiShareForwardLine />
              </IconButton>
              <Button
                size="large"
                variant="contained"
                disabled={isInCart || purchaseUnavailable}
                startIcon={<RiAddLine />}
                onClick={handleAdd}
                sx={{ borderRadius: 6, px: { xs: 2, sm: 3 } }}
              >
                {addButtonLabel}
              </Button>
            </Stack>
          </Stack>

          <Box
            sx={{
              p: { xs: 1.5, sm: 3, md: 5 },
              minHeight: { xs: 380, md: 640 },
              display: 'grid',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 3,
              placeItems: 'center',
              bgcolor: '#E7F0F5',
            }}
          >
            {coverUrl ? (
              <Box
                component="img"
                src={coverUrl}
                alt={content.title}
                sx={{
                  width: 1,
                  height: 1,
                  maxHeight: 720,
                  objectFit: 'contain',
                  borderRadius: 1.5,
                  boxShadow: '0 18px 55px rgba(15, 23, 42, 0.16)',
                }}
              />
            ) : (
              <Stack spacing={2} alignItems="center" color="primary.main">
                <RiBookOpenLine size={110} />
                <Typography variant="h4">ตัวอย่างสื่อการสอน</Typography>
              </Stack>
            )}
          </Box>

          {galleryImages.length > 1 && (
            <Stack direction="row" spacing={1.25} sx={{ overflowX: 'auto', pb: 0.5 }}>
              {galleryImages.map((image, index) => (
                <Box
                  key={image.id}
                  component="button"
                  type="button"
                  onClick={() => setActiveImageIndex(index)}
                  sx={{
                    p: 0,
                    width: 92,
                    height: 68,
                    flexShrink: 0,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    borderRadius: 1.5,
                    bgcolor: 'background.paper',
                    border: '2px solid',
                    borderColor: activeImageIndex === index ? 'primary.main' : 'divider',
                  }}
                >
                  <Box
                    component="img"
                    src={image.url}
                    alt={`${content.title} ${index + 1}`}
                    sx={{ width: 1, height: 1, objectFit: 'cover' }}
                  />
                </Box>
              ))}
            </Stack>
          )}

          <Grid container spacing={{ xs: 3, md: 5 }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip label={product.category} color="primary" variant="soft" />
                  <Chip label={product.media_type?.name ?? 'สื่อการสอน'} variant="outlined" />
                  {product.subject_label && (
                    <Chip label={product.subject_label} variant="outlined" />
                  )}
                </Stack>
                <Box>
                  <Typography variant="h4">เกี่ยวกับสินค้านี้</Typography>
                  <Typography
                    color="text.secondary"
                    sx={{ mt: 1.5, lineHeight: 1.9, whiteSpace: 'pre-line' }}
                  >
                    {stripHtml(content.description)}
                  </Typography>
                </Box>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  ราคา
                </Typography>
                <Typography variant="h3" color="primary.main" sx={{ mt: 0.5 }}>
                  {formatPrice(Number(product.price), product.currency)}
                </Typography>
                <Stack direction="row" spacing={2.5} sx={{ my: 2.5 }}>
                  <Box>
                    <Typography variant="subtitle1">
                      {engagement.views.toLocaleString('th-TH')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ผู้เข้าชม
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle1">
                      {engagement.purchases.toLocaleString('th-TH')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ยอดซื้อ
                    </Typography>
                  </Box>
                </Stack>
                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  disabled={isInCart || purchaseUnavailable}
                  onClick={handleAdd}
                >
                  {addButtonLabel}
                </Button>
                <Button
                  fullWidth
                  component={RouterLink}
                  href={authenticated ? paths.marketplace.dashboardCart : paths.marketplace.cart}
                  color="inherit"
                  sx={{ mt: 1 }}
                >
                  ไปที่ตะกร้า
                </Button>
              </Card>
            </Grid>
          </Grid>

          <Divider />

          <Box component="section" aria-labelledby="product-highlights-title">
            <Typography id="product-highlights-title" variant="h4" sx={{ mb: 2.5 }}>
              Highlights สินค้า
            </Typography>
            <Grid container spacing={2}>
              {[
                {
                  icon: <RiDownloadCloud2Line />,
                  label: 'รูปแบบ',
                  value:
                    product.media_type?.name ??
                    (product.resource_type === 'digital' ? 'ดาวน์โหลดดิจิทัล' : 'สินค้า'),
                },
                {
                  icon: <RiGraduationCapLine />,
                  label: 'ระดับชั้น',
                  value:
                    product.grade_levels
                      ?.map((item) => item.grade_level.name)
                      .filter(Boolean)
                      .join(', ') || 'ใช้ได้หลายระดับชั้น',
                },
                {
                  icon: <RiBook2Line />,
                  label: 'รายวิชา',
                  value: product.subject_label || 'สื่อการเรียนรู้ทั่วไป',
                },
                {
                  icon: <RiFileLine />,
                  label: 'หลักสูตร',
                  value: product.curriculum?.name || 'ไม่ระบุหลักสูตร',
                },
                {
                  icon: <RiPriceTag3Line />,
                  label: 'แท็ก',
                  value:
                    product.tags
                      ?.map((item) => item.tag.name)
                      .filter(Boolean)
                      .join(', ') || 'สื่อการสอน',
                },
                {
                  icon: <RiShieldCheckLine />,
                  label: 'สิทธิ์การใช้งาน',
                  value:
                    product.resource_type === 'feature_unlock'
                      ? `${product.license_scope === 'teacher' ? 'License รายครู' : 'License โรงเรียน'} · ${
                          product.grant_duration_days ?? 30
                        } วัน`
                      : 'สิทธิ์ใช้งานต่อรายการสั่งซื้อ',
                },
              ].map((highlight) => (
                <Grid key={highlight.label} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card variant="outlined" sx={{ p: 2.5, height: 1, borderRadius: 2.5 }}>
                    <Stack direction="row" spacing={1.75} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          flexShrink: 0,
                          display: 'grid',
                          borderRadius: 1.5,
                          placeItems: 'center',
                          color: 'primary.main',
                          bgcolor: 'primary.lighter',
                        }}
                      >
                        {highlight.icon}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">
                          {highlight.label}
                        </Typography>
                        <Typography variant="subtitle2" sx={{ mt: 0.25 }}>
                          {highlight.value}
                        </Typography>
                      </Box>
                    </Stack>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>

          <Divider />

          <Box component="section" aria-labelledby="product-reviews-title">
            <Typography id="product-reviews-title" variant="h4" sx={{ mb: 2.5 }}>
              คะแนนและรีวิว
            </Typography>

            <Grid container spacing={{ xs: 3, md: 4 }}>
              <Grid size={{ xs: 12, md: 5 }}>
                <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 3 }}>
                  <Stack spacing={2.25}>
                    <Stack alignItems="center" spacing={0.75} sx={{ textAlign: 'center' }}>
                      <Typography variant="h2">
                        {engagement.averageRating ? engagement.averageRating.toFixed(1) : '0.0'}
                      </Typography>
                      <Rating
                        size="large"
                        value={engagement.averageRating}
                        precision={0.1}
                        readOnly
                      />
                      <Typography color="text.secondary">
                        จาก {engagement.reviewCount.toLocaleString('th-TH')} รีวิว
                      </Typography>
                    </Stack>

                    <Divider />

                    {engagement.canReview ? (
                      engagement.myReview && !reviewEditing ? (
                        <Box
                          sx={{
                            p: 2.25,
                            borderRadius: 2,
                            bgcolor: 'background.neutral',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Stack spacing={1.5}>
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              spacing={1}
                            >
                              <Typography variant="h6">รีวิวของคุณ</Typography>
                              <Button size="small" variant="outlined" onClick={handleEditReview}>
                                แก้ไขรีวิว
                              </Button>
                            </Stack>
                            <Rating value={engagement.myReview.rating} readOnly />
                            <Typography
                              color={
                                engagement.myReview.comment ? 'text.primary' : 'text.secondary'
                              }
                              sx={{ whiteSpace: 'pre-line' }}
                            >
                              {engagement.myReview.comment || 'ไม่ได้เขียนข้อความรีวิว'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              แก้ไขล่าสุด{' '}
                              {new Intl.DateTimeFormat('th-TH', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              }).format(new Date(engagement.myReview.updated_at))}
                            </Typography>
                            {reviewSaved && <Alert severity="success">{reviewSaved}</Alert>}
                          </Stack>
                        </Box>
                      ) : (
                        <>
                          <Typography variant="h6">
                            {engagement.myReview ? 'แก้ไขรีวิวของคุณ' : 'ให้คะแนนสินค้านี้'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            เลือกคะแนนและแก้ไขข้อความด้านล่าง แล้วกดบันทึกการเปลี่ยนแปลง
                          </Typography>
                          <Rating
                            size="large"
                            value={reviewRating}
                            onChange={(_event, value) => setReviewRating(value)}
                          />
                          <TextField
                            fullWidth
                            multiline
                            minRows={5}
                            value={reviewComment}
                            label="ข้อความรีวิว"
                            placeholder="เล่าประสบการณ์หลังนำสื่อนี้ไปใช้งาน..."
                            inputProps={{ maxLength: 1000 }}
                            helperText={`${reviewComment.length}/1,000 ตัวอักษร`}
                            onChange={(event) => setReviewComment(event.target.value)}
                          />
                          {reviewError && <Alert severity="error">{reviewError}</Alert>}
                          <Stack direction="row" spacing={1}>
                            <Button
                              fullWidth
                              variant="contained"
                              disabled={!reviewRating || reviewSaving}
                              onClick={handleReviewSubmit}
                            >
                              {reviewSaving
                                ? 'กำลังบันทึก...'
                                : engagement.myReview
                                  ? 'บันทึกการแก้ไข'
                                  : 'เผยแพร่รีวิว'}
                            </Button>
                            {engagement.myReview && (
                              <Button
                                color="inherit"
                                variant="outlined"
                                disabled={reviewSaving}
                                onClick={handleCancelReviewEdit}
                              >
                                ยกเลิก
                              </Button>
                            )}
                          </Stack>
                        </>
                      )
                    ) : (
                      <Alert severity="info">
                        ผู้ซื้อที่ชำระเงินสำเร็จแล้วสามารถให้ดาวและเขียนรีวิวได้
                      </Alert>
                    )}
                  </Stack>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 7 }}>
                <Stack spacing={2}>
                  {engagement.reviews.length ? (
                    engagement.reviews.map((review) => (
                      <Card key={review.id} variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
                        <Stack spacing={1.25}>
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            justifyContent="space-between"
                            spacing={1}
                          >
                            <Typography variant="subtitle1">{review.reviewer_name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Intl.DateTimeFormat('th-TH', {
                                dateStyle: 'medium',
                              }).format(new Date(review.updated_at))}
                            </Typography>
                          </Stack>
                          <Rating size="small" value={review.rating} readOnly />
                          {review.comment && (
                            <Typography color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                              {review.comment}
                            </Typography>
                          )}
                        </Stack>
                      </Card>
                    ))
                  ) : (
                    <Card
                      variant="outlined"
                      sx={{
                        minHeight: 260,
                        display: 'grid',
                        borderRadius: 3,
                        textAlign: 'center',
                        placeItems: 'center',
                      }}
                    >
                      <Box>
                        <RiStarLine size={42} />
                        <Typography variant="h6" sx={{ mt: 1 }}>
                          ยังไม่มีรีวิว
                        </Typography>
                        <Typography color="text.secondary">
                          เป็นคนแรกที่รีวิวสินค้านี้ได้หลังการซื้อ
                        </Typography>
                      </Box>
                    </Card>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </Box>

          <Box
            component="section"
            aria-labelledby="seller-showcase-title"
            sx={{ pt: { xs: 3, md: 6 } }}
          >
            <Stack direction="row" spacing={{ xs: 2, md: 4 }} alignItems="center">
              <Divider sx={{ flex: 1 }} />
              {sellerAvatar(84)}
              <Divider sx={{ flex: 1 }} />
            </Stack>

            <Stack alignItems="center" spacing={1.25} sx={{ mt: 2.5, textAlign: 'center' }}>
              <Box id="seller-showcase-title">{sellerName('h4')}</Box>
              <Typography color="text.secondary" sx={{ maxWidth: 620 }}>
                {product.seller?.bio ||
                  'ร้านค้าสื่อการสอนคุณภาพที่ผ่านการตรวจสอบโดย E-KRU Marketplace'}
              </Typography>
              {!!storeHref && (
                <Button
                  component={RouterLink}
                  href={storeHref}
                  color="inherit"
                  variant="contained"
                  sx={{ mt: 1, px: 3, borderRadius: 6 }}
                >
                  ดูโปรไฟล์ร้าน
                </Button>
              )}
            </Stack>

            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={2}
              sx={{ mt: { xs: 5, md: 7 }, mb: 2.5 }}
            >
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography variant="h5">สินค้าอื่นจาก</Typography>
                <MarketplaceSellerLink
                  seller={product.seller}
                  showAvatar={false}
                  nameVariant="h5"
                  fallbackName="ร้านนี้"
                />
              </Stack>
              {!!storeHref && (
                <Button
                  component={RouterLink}
                  href={storeHref}
                  color="inherit"
                  sx={{ flexShrink: 0 }}
                >
                  ดูสินค้าทั้งหมด
                </Button>
              )}
            </Stack>

            {sellerProductsLoading ? (
              <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
                <CircularProgress />
              </Box>
            ) : sellerProducts.length ? (
              <Grid container spacing={2.5}>
                {sellerProducts.map((sellerProduct) => {
                  const sellerProductCover =
                    sellerProduct.images?.find((image) => image.is_cover)?.url ??
                    sellerProduct.images?.[0]?.url ??
                    sellerProduct.cover_url ??
                    undefined;

                  return (
                    <Grid key={sellerProduct.id} size={{ xs: 12, sm: 6, md: 3 }}>
                      <Box
                        component="button"
                        type="button"
                        onClick={() => onSelectProduct?.(sellerProduct)}
                        sx={{
                          p: 0,
                          width: 1,
                          border: 0,
                          cursor: 'pointer',
                          textAlign: 'left',
                          color: 'text.primary',
                          bgcolor: 'transparent',
                        }}
                      >
                        <Box
                          sx={{
                            width: 1,
                            display: 'grid',
                            overflow: 'hidden',
                            aspectRatio: '4 / 3',
                            borderRadius: 2,
                            placeItems: 'center',
                            bgcolor: 'background.neutral',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          {sellerProductCover ? (
                            <Box
                              component="img"
                              src={sellerProductCover}
                              alt={sellerProduct.title}
                              sx={{
                                width: 1,
                                height: 1,
                                objectFit: 'cover',
                                transition: 'transform 240ms ease',
                                'button:hover &': { transform: 'scale(1.035)' },
                              }}
                            />
                          ) : (
                            <RiBookOpenLine size={48} color="#1565F5" />
                          )}
                        </Box>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            mt: 1.25,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {getLocalizedProduct(sellerProduct, currentLang.value).title}
                        </Typography>
                        <Typography variant="body2" color="primary.main" sx={{ mt: 0.5 }}>
                          {formatPrice(Number(sellerProduct.price), sellerProduct.currency)}
                        </Typography>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            ) : (
              <Box
                sx={{
                  py: 7,
                  textAlign: 'center',
                  borderRadius: 2,
                  bgcolor: 'background.neutral',
                }}
              >
                <Typography color="text.secondary">ยังไม่มีสินค้าอื่นจากร้านนี้</Typography>
              </Box>
            )}
          </Box>

          <Box
            component="section"
            aria-labelledby="related-products-modal-title"
            sx={{ pt: { xs: 4, md: 6 }, borderTop: '1px solid', borderColor: 'divider' }}
          >
            <Typography id="related-products-modal-title" variant="h4">
              สินค้าใกล้เคียงใน E-KRU Marketplace
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75, mb: 3 }}>
              สื่อการสอนในหมวดหมู่เดียวกันที่คุณอาจสนใจ
            </Typography>

            {relatedProductsLoading ? (
              <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
                <CircularProgress />
              </Box>
            ) : visibleRelatedProducts.length ? (
              <Grid container spacing={2.5}>
                {visibleRelatedProducts.map((relatedProduct) => {
                  const relatedProductCover =
                    relatedProduct.images?.find((image) => image.is_cover)?.url ??
                    relatedProduct.images?.[0]?.url ??
                    relatedProduct.cover_url ??
                    undefined;

                  return (
                    <Grid key={relatedProduct.id} size={{ xs: 12, sm: 6, md: 3 }}>
                      <Box
                        sx={{
                          p: 0,
                          width: 1,
                          textAlign: 'left',
                          color: 'text.primary',
                          bgcolor: 'transparent',
                        }}
                      >
                        <Box
                          component="button"
                          type="button"
                          onClick={() => onSelectProduct?.(relatedProduct)}
                          sx={{
                            p: 0,
                            width: 1,
                            cursor: 'pointer',
                            display: 'grid',
                            overflow: 'hidden',
                            aspectRatio: '4 / 3',
                            borderRadius: 2,
                            placeItems: 'center',
                            bgcolor: 'background.neutral',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          {relatedProductCover ? (
                            <Box
                              component="img"
                              src={relatedProductCover}
                              alt={relatedProduct.title}
                              sx={{
                                width: 1,
                                height: 1,
                                objectFit: 'cover',
                                transition: 'transform 240ms ease',
                                'button:hover &': { transform: 'scale(1.035)' },
                              }}
                            />
                          ) : (
                            <RiBookOpenLine size={48} color="#1565F5" />
                          )}
                        </Box>
                        <Typography
                          component="button"
                          type="button"
                          onClick={() => onSelectProduct?.(relatedProduct)}
                          variant="subtitle2"
                          sx={{
                            p: 0,
                            border: 0,
                            cursor: 'pointer',
                            textAlign: 'left',
                            color: 'text.primary',
                            bgcolor: 'transparent',
                            mt: 1.25,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {getLocalizedProduct(relatedProduct, currentLang.value).title}
                        </Typography>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          spacing={1}
                          sx={{ mt: 0.5 }}
                        >
                          <Typography variant="body2" color="primary.main">
                            {formatPrice(Number(relatedProduct.price), relatedProduct.currency)}
                          </Typography>
                          <MarketplaceSellerLink
                            seller={relatedProduct.seller}
                            showAvatar={false}
                            nameVariant="caption"
                            fallbackName="ร้านค้า E-KRU"
                            nameSx={{ color: 'text.secondary' }}
                          />
                        </Stack>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            ) : (
              <Box
                sx={{
                  py: 7,
                  textAlign: 'center',
                  borderRadius: 2,
                  bgcolor: 'background.neutral',
                }}
              >
                <Typography color="text.secondary">ยังไม่มีสินค้าใกล้เคียงในหมวดหมู่นี้</Typography>
              </Box>
            )}
          </Box>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 8 } }}>
      <Button
        component={RouterLink}
        href="/products"
        color="inherit"
        startIcon={<RiArrowLeftLine />}
      >
        กลับไป Marketplace
      </Button>

      <Grid container spacing={{ xs: 4, md: 5 }} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={2}>
            {galleryImages.length > 1 && (
              <Stack
                direction={{ xs: 'row', sm: 'column' }}
                spacing={1.25}
                sx={{ overflowX: 'auto', flexShrink: 0 }}
              >
                {galleryImages.map((image, index) => (
                  <Box
                    key={image.id}
                    component="button"
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    sx={{
                      p: 0,
                      width: 72,
                      height: 72,
                      flexShrink: 0,
                      cursor: 'pointer',
                      overflow: 'hidden',
                      borderRadius: 1.5,
                      bgcolor: 'background.paper',
                      border: '2px solid',
                      borderColor: activeImageIndex === index ? 'primary.main' : 'divider',
                    }}
                  >
                    <Box
                      component="img"
                      src={image.url}
                      alt={`${content.title} ${index + 1}`}
                      sx={{ width: 1, height: 1, objectFit: 'cover' }}
                    />
                  </Box>
                ))}
              </Stack>
            )}

            <Stack spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
              <Box
                sx={{
                  height: { xs: 360, md: 560 },
                  display: 'grid',
                  overflow: 'hidden',
                  borderRadius: 2.5,
                  placeItems: 'center',
                  bgcolor: 'grey.50',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {coverUrl ? (
                  <Box
                    component="img"
                    src={coverUrl}
                    alt={content.title}
                    sx={{ width: 1, height: 1, objectFit: 'contain' }}
                  />
                ) : (
                  <RiBookOpenLine size={120} color="#1565F5" />
                )}
              </Box>
              {product.resource_type === 'digital' && (
                <Button
                  fullWidth
                  variant="outlined"
                  disabled={previewLoading}
                  startIcon={<RiEyeLine />}
                  onClick={handlePreview}
                >
                  {previewLoading ? 'กำลังเปิดตัวอย่าง...' : 'ดูไฟล์ตัวอย่าง'}
                </Button>
              )}
              {previewError && <Alert severity="info">{previewError}</Alert>}
            </Stack>
          </Stack>

          <Box sx={{ mt: 4 }}>
            <Typography variant="h4" sx={{ mb: 1.5 }}>
              รายละเอียดสินค้า
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-line', color: 'text.secondary', lineHeight: 1.9 }}>
              {stripHtml(content.description)}
            </Typography>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2.5} sx={{ position: { md: 'sticky' }, top: { md: 96 } }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={product.category} color="primary" variant="soft" />
              <Chip
                label={
                  product.media_type?.name ??
                  (product.resource_type === 'digital'
                    ? 'ไฟล์ดิจิทัล'
                    : product.resource_type === 'service'
                      ? 'บริการ'
                      : 'สินค้าจัดส่ง')
                }
                variant="outlined"
              />
              {product.sale_type?.name && (
                <Chip label={product.sale_type.name} color="success" variant="soft" />
              )}
            </Stack>

            <Typography component="h1" variant="h3">
              {content.title}
            </Typography>

            <Stack direction="row" spacing={1.25} alignItems="center">
              <Rating value={engagement.averageRating} precision={0.1} readOnly />
              <Typography variant="subtitle2">
                {engagement.reviewCount
                  ? `${engagement.averageRating.toFixed(1)} (${engagement.reviewCount} รีวิว)`
                  : 'ยังไม่มีรีวิว'}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="center">
              {sellerAvatar(44)}
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  {sellerName()}
                  {product.seller?.seller_type === 'teacher' && (
                    <RiShieldCheckLine color="#1565F5" />
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  ร้านค้าที่ผ่านการตรวจสอบโดย E-KRU Marketplace
                </Typography>
              </Box>
            </Stack>

            <Typography variant="h3" color="primary.main">
              {formatPrice(Number(product.price), product.currency)}
            </Typography>

            <Stack spacing={1.25}>
              <Button
                fullWidth
                size="large"
                color={isInCart || purchaseUnavailable ? 'success' : 'primary'}
                variant="contained"
                disabled={isInCart || purchaseUnavailable}
                startIcon={<RiAddLine />}
                onClick={handleAdd}
                sx={
                  isInCart || purchaseUnavailable
                    ? { '&.Mui-disabled': { color: 'common.white', bgcolor: 'success.main' } }
                    : undefined
                }
              >
                {addButtonLabel}
              </Button>
              <Button
                fullWidth
                size="large"
                variant="outlined"
                component={RouterLink}
                href={authenticated ? paths.marketplace.dashboardCart : paths.marketplace.cart}
              >
                ไปที่ตะกร้า
              </Button>
            </Stack>

            {purchaseUnavailable && purchaseAccess?.message && (
              <Alert severity="info">{purchaseAccess.message}</Alert>
            )}

            {product.resource_type === 'digital' && (
              <Alert severity="success" icon={<RiDownloadCloud2Line />}>
                ดาวน์โหลดไฟล์ได้จากหน้ารายการซื้อทันทีหลังชำระเงิน
              </Alert>
            )}
            {product.resource_type === 'feature_unlock' && (
              <Alert severity="info" icon={<RiShieldCheckLine />}>
                <Typography variant="subtitle2">
                  {product.license_scope === 'teacher'
                    ? `License สำหรับครู ${product.license_seat_count ?? 1} Seat`
                    : 'License สำหรับผู้ใช้ทั้งโรงเรียน'}
                </Typography>
                <Typography variant="body2">
                  ใช้งาน {product.grant_duration_days ?? 30} วัน ·{' '}
                  {(product.grants_feature_keys?.length
                    ? product.grants_feature_keys
                    : product.grants_feature_key
                      ? [product.grants_feature_key]
                      : []
                  )
                    .map((key) => featureLabels.get(key) ?? key)
                    .join(', ')}
                </Typography>
              </Alert>
            )}

            <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
              <Typography variant="h5" sx={{ mb: 2.25 }}>
                ไฮไลต์สินค้า
              </Typography>
              <Stack spacing={2}>
                {[
                  {
                    icon: <RiDownloadCloud2Line />,
                    label: 'รูปแบบ',
                    value:
                      product.media_type?.name ??
                      (product.resource_type === 'digital' ? 'ดาวน์โหลดดิจิทัล' : 'สินค้า'),
                  },
                  {
                    icon: <RiGraduationCapLine />,
                    label: 'ระดับชั้น',
                    value:
                      product.grade_levels
                        ?.map((item) => item.grade_level.name)
                        .filter(Boolean)
                        .join(', ') || 'ใช้ได้หลายระดับชั้น',
                  },
                  {
                    icon: <RiBook2Line />,
                    label: 'รายวิชา',
                    value: product.subject_label || 'สื่อการเรียนรู้ทั่วไป',
                  },
                  {
                    icon: <RiFileLine />,
                    label: 'หลักสูตร',
                    value: product.curriculum?.name || 'ไม่ระบุหลักสูตร',
                  },
                  {
                    icon: <RiPriceTag3Line />,
                    label: 'แท็ก',
                    value:
                      product.tags
                        ?.map((item) => item.tag.name)
                        .filter(Boolean)
                        .join(', ') || 'สื่อการสอน',
                  },
                ].map((item) => (
                  <Stack key={item.label} direction="row" spacing={1.5} alignItems="flex-start">
                    <Box sx={{ color: 'text.secondary', display: 'flex', mt: 0.25 }}>
                      {item.icon}
                    </Box>
                    <Typography variant="body2">
                      <Box component="span" sx={{ mr: 1, fontWeight: 700 }}>
                        {item.label}
                      </Box>
                      <Box component="span" sx={{ color: 'text.secondary' }}>
                        {item.value}
                      </Box>
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Card>

            <Grid container spacing={1}>
              {[
                { label: 'ผู้เข้าชม', value: engagement.views, icon: <RiEyeLine /> },
                { label: 'ยอดซื้อ', value: engagement.purchases, icon: <RiShoppingBag3Line /> },
                {
                  label: 'ดาวน์โหลด',
                  value: engagement.downloads,
                  icon: <RiDownloadCloud2Line />,
                },
              ].map((stat) => (
                <Grid key={stat.label} size={{ xs: 4 }}>
                  <Card variant="outlined" sx={{ p: 1.25, height: 1, textAlign: 'center' }}>
                    <Box sx={{ color: 'primary.main', display: 'flex', justifyContent: 'center' }}>
                      {stat.icon}
                    </Box>
                    <Typography variant="subtitle1">
                      {stat.value.toLocaleString('th-TH')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {stat.label}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </Grid>
      </Grid>

      <Divider sx={{ my: { xs: 5, md: 8 } }} />

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 3 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <RiStarLine size={24} />
                <Typography variant="h5">
                  {engagement.myReview ? 'แก้ไขรีวิวของคุณ' : 'ให้คะแนนสินค้านี้'}
                </Typography>
              </Stack>
              {engagement.canReview ? (
                <>
                  <Typography color="text.secondary">
                    ให้คะแนนและแชร์ประสบการณ์หลังใช้งานสินค้า
                  </Typography>
                  <Rating
                    size="large"
                    value={reviewRating}
                    onChange={(_event, value) => setReviewRating(value)}
                  />
                  <TextField
                    multiline
                    minRows={4}
                    value={reviewComment}
                    label="เขียนรีวิว (ไม่บังคับ)"
                    inputProps={{ maxLength: 1000 }}
                    helperText={`${reviewComment.length}/1,000`}
                    onChange={(event) => setReviewComment(event.target.value)}
                  />
                  {reviewError && <Alert severity="error">{reviewError}</Alert>}
                  {reviewSaved && <Alert severity="success">{reviewSaved}</Alert>}
                  <Button
                    variant="contained"
                    disabled={!reviewRating || reviewSaving}
                    onClick={handleReviewSubmit}
                  >
                    {reviewSaving ? 'กำลังบันทึก...' : 'บันทึกรีวิว'}
                  </Button>
                </>
              ) : (
                <Alert severity="info">
                  ผู้ซื้อที่ชำระเงินสำเร็จแล้วเท่านั้นจึงจะให้ดาวและเขียนรีวิวได้
                </Alert>
              )}
            </Stack>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={2.5}>
            <Typography variant="h4">รีวิวจากผู้ซื้อ</Typography>
            {engagement.reviews.length ? (
              engagement.reviews.map((review) => (
                <Card key={review.id} variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                  <Stack spacing={1.25}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      justifyContent="space-between"
                    >
                      <Typography variant="subtitle1">{review.reviewer_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Intl.DateTimeFormat('th-TH', {
                          dateStyle: 'medium',
                        }).format(new Date(review.updated_at))}
                      </Typography>
                    </Stack>
                    <Rating size="small" value={review.rating} readOnly />
                    {review.comment && (
                      <Typography color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                        {review.comment}
                      </Typography>
                    )}
                  </Stack>
                </Card>
              ))
            ) : (
              <Card variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
                <RiStarLine size={36} />
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  ยังไม่มีรีวิว เป็นคนแรกที่รีวิวสินค้านี้ได้หลังการซื้อ
                </Typography>
              </Card>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
