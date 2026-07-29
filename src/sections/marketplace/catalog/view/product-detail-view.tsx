'use client';

import type { MarketplaceProduct } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Rating from '@mui/material/Rating';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';
import { SCHOOL_FEATURES } from 'src/lib/school-subscription-config';

import {
  RiAddLine,
  RiEyeLine,
  RiFileLine,
  RiStarLine,
  RiBook2Line,
  RiStore2Line,
  RiBookOpenLine,
  RiPriceTag3Line,
  RiArrowLeftLine,
  RiShieldCheckLine,
  RiShoppingBag3Line,
  RiGraduationCapLine,
  RiDownloadCloud2Line,
} from 'src/components/remix-icon';

import { findSampleProduct } from '../../shared/constants';
import { useMarketplaceCart } from '../../cart/cart-context';
import {
  stripHtml,
  getProduct,
  formatPrice,
  recordProductView,
  saveProductReview,
  getLocalizedProduct,
  getProductPreviewFiles,
} from '../../shared/api';

const VISITOR_STORAGE_KEY = 'ekru_marketplace_visitor_id';
const featureLabels = new Map<string, string>(
  SCHOOL_FEATURES.map((feature) => [feature.key, feature.label])
);

export function MarketplaceProductDetailView({ productId }: { productId: string }) {
  const { currentLang } = useTranslate();
  const { items, addItem } = useMarketplaceCart();
  const [product, setProduct] = useState<MarketplaceProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const [reviewRating, setReviewRating] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSaved, setReviewSaved] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

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
        setProduct(result.product);
        setReviewRating(result.product.engagement?.myReview?.rating ?? null);
        setReviewComment(result.product.engagement?.myReview?.comment ?? '');

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
      setReviewSaved(result.message);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'ไม่สามารถบันทึกรีวิวได้');
    } finally {
      setReviewSaving(false);
    }
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

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
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
              <Avatar
                src={product.seller?.logo_url ?? undefined}
                alt={product.seller?.display_name}
                sx={{ width: 44, height: 44, bgcolor: 'primary.lighter', color: 'primary.main' }}
              >
                <RiStore2Line />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Typography variant="subtitle1">
                    {product.seller?.display_name ?? 'ผู้ขาย eKru'}
                  </Typography>
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
              <Button fullWidth size="large" variant="outlined" component={RouterLink} href="/cart">
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
