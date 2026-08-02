'use client';

import type { MarketplaceProduct, MarketplaceProductReview } from '../../shared/types';

import Script from 'next/script';
import { useMemo, useState, useEffect } from 'react';
import { LineIcon, EmailIcon, FacebookIcon, LineShareButton, EmailShareButton } from 'react-share';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Rating from '@mui/material/Rating';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Popover from '@mui/material/Popover';
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

import { Markdown } from 'src/components/markdown';
import {
  RiAddLine,
  RiEyeLine,
  RiFileLine,
  RiStarLine,
  RiCloseLine,
  RiHeartLine,
  RiBook2Line,
  RiHeartFill,
  RiBookmarkLine,
  RiBookOpenLine,
  RiImageAddLine,
  RiBookmarkFill,
  RiPriceTag3Line,
  RiArrowLeftLine,
  RiShieldCheckLine,
  RiShareForwardLine,
  RiShoppingBag3Line,
  RiGraduationCapLine,
  RiCheckboxCircleLine,
  RiDownloadCloud2Line,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { findSampleProduct } from '../../shared/constants';
import { useMarketplaceCart } from '../../cart/cart-context';
import { getMarketplacePricing } from '../../shared/pricing';
import { hasAnalyticsConsent } from '../../legal/cookie-consent';
import { MarketplaceSellerLink } from '../../shared/seller-link';
import { MARKETPLACE_SELLER_LINE_FEATURE } from '../../seller/line-feature';
import {
  getProduct,
  getProducts,
  formatPrice,
  recordProductView,
  saveProductReview,
  getRelatedProducts,
  replyProductReview,
  getLocalizedProduct,
  getProductPreference,
  getProductPreviewFiles,
  updateProductCollection,
} from '../../shared/api';

const VISITOR_STORAGE_KEY = 'ekru_marketplace_visitor_id';
const RECOMMENDATION_SESSION_KEY = 'ekru_marketplace_recommendation_session';
const FACEBOOK_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID?.trim();
const FACEBOOK_API_VERSION = process.env.NEXT_PUBLIC_FACEBOOK_API_VERSION?.trim() || 'v23.0';

declare global {
  interface Window {
    FB?: {
      init: (options: {
        appId: string;
        cookie?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      ui: (options: { method: 'share'; href: string; hashtag?: string; display?: 'popup' }) => void;
    };
  }
}

const featureLabels = new Map<string, string>(
  [...SCHOOL_FEATURES, MARKETPLACE_SELLER_LINE_FEATURE].map((feature) => [
    feature.key,
    feature.label,
  ])
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
  const { t, currentLang } = useTranslate('marketplace');
  const router = useRouter();
  const pathname = usePathname();
  const { authenticated } = useAuthContext();
  const { items, addItem } = useMarketplaceCart();
  const [product, setProduct] = useState<MarketplaceProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const [reviewRating, setReviewRating] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewImages, setReviewImages] = useState<File[]>([]);
  const [keptReviewImageIds, setKeptReviewImageIds] = useState<string[]>([]);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewEditing, setReviewEditing] = useState(true);
  const [reviewError, setReviewError] = useState('');
  const [reviewSaved, setReviewSaved] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySavingId, setReplySavingId] = useState('');
  const [replyError, setReplyError] = useState('');
  const [replyErrorId, setReplyErrorId] = useState('');
  const reviewImagePreviews = useMemo(
    () => reviewImages.map((image) => URL.createObjectURL(image)),
    [reviewImages]
  );
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
  const [shareUrl, setShareUrl] = useState('');
  const [shareAnchorEl, setShareAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const configuredOrigin =
      process.env.NEXT_PUBLIC_MARKETPLACE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SERVER_URL?.trim() ||
      window.location.origin;
    const publicOrigin = /^https?:\/\//i.test(configuredOrigin)
      ? configuredOrigin
      : `https://${configuredOrigin}`;

    setShareUrl(new URL(paths.marketplace.product(productId), `${publicOrigin}/`).toString());
    setShareAnchorEl(null);
  }, [productId]);

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
        setKeptReviewImageIds(myReview?.images.map((image) => image.id) ?? []);
        setReviewEditing(!myReview);

        if (hasAnalyticsConsent()) {
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
        }
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
    if (!modalMode || !product?.id) return undefined;
    let active = true;
    setRelatedProductsLoading(true);

    let viewerKey = window.sessionStorage.getItem(RECOMMENDATION_SESSION_KEY);
    if (!viewerKey) {
      viewerKey = window.crypto.randomUUID();
      window.sessionStorage.setItem(RECOMMENDATION_SESSION_KEY, viewerKey);
    }

    getRelatedProducts(product.id, viewerKey)
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
  }, [modalMode, product?.id]);

  useEffect(
    () => () => reviewImagePreviews.forEach((preview) => URL.revokeObjectURL(preview)),
    [reviewImagePreviews]
  );

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
        <Alert severity="warning">{t('productDetail.notFound')}</Alert>
        <Button
          component={RouterLink}
          href="/products"
          startIcon={<RiArrowLeftLine />}
          sx={{ mt: 3 }}
        >
          {t('productDetail.actions.backToProducts')}
        </Button>
      </Container>
    );
  }

  const content = getLocalizedProduct(product, currentLang.value);
  const pricing = getMarketplacePricing(product);
  const purchaseBenefits = (product.purchase_benefits ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  const gradeLevelHighlight =
    product.grade_levels
      ?.map((item) => item.grade_level.name?.trim())
      .filter(Boolean)
      .join(', ') ?? '';
  const tagHighlight =
    product.tags
      ?.map((item) => item.tag.name?.trim())
      .filter(Boolean)
      .join(', ') ?? '';
  const productHighlights = [
    {
      icon: <RiDownloadCloud2Line />,
      label: t('productDetail.highlights.format'),
      value: product.media_type?.name?.trim() ?? '',
    },
    {
      icon: <RiGraduationCapLine />,
      label: t('productDetail.highlights.grade'),
      value: gradeLevelHighlight,
    },
    {
      icon: <RiBook2Line />,
      label: t('productDetail.highlights.subject'),
      value: product.subject_label?.trim() ?? '',
    },
    {
      icon: <RiFileLine />,
      label: t('productDetail.highlights.curriculum'),
      value: product.curriculum?.name?.trim() ?? '',
    },
    {
      icon: <RiPriceTag3Line />,
      label: t('productDetail.highlights.tags'),
      value: tagHighlight,
    },
  ].filter((item) => Boolean(item.value));
  const licenseHighlight =
    product.resource_type === 'feature_unlock' && product.license_scope
      ? {
          icon: <RiShieldCheckLine />,
          label: t('productDetail.highlights.license'),
          value: `${
            product.license_scope === 'individual'
              ? t('productDetail.license.individualShort')
              : product.license_scope === 'teacher'
                ? t('productDetail.license.teacherShort')
                : product.license_scope === 'platform'
                  ? t('productDetail.license.platformShort')
                  : t('productDetail.license.schoolShort')
          }${
            product.license_billing_cycle === 'monthly'
              ? ' · รายเดือน'
              : product.license_billing_cycle === 'yearly'
                ? ' · รายปี'
                : product.license_billing_cycle === 'contract'
                  ? ` · ตามสัญญา ${product.grant_duration_days ?? 0} วัน`
                  : product.grant_duration_days == null
                    ? ' · ซื้อขาด'
                    : ` · ${t('productDetail.license.days', { count: product.grant_duration_days })}`
          } · ${
            product.license_target_system === 'marketplace'
              ? t('productDetail.license.targetMarketplace')
              : t('productDetail.license.targetEkru')
          }`,
        }
      : null;
  const modalProductHighlights = licenseHighlight
    ? [...productHighlights, licenseHighlight]
    : productHighlights;

  const handleAdd = () => {
    addItem(product);
    setAdded(true);
  };

  const handleFacebookShare = () => {
    setShareAnchorEl(null);

    if (FACEBOOK_APP_ID && window.FB) {
      window.FB.ui({
        method: 'share',
        href: shareUrl,
        hashtag: '#EKRU',
        display: 'popup',
      });
      return;
    }

    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&hashtag=${encodeURIComponent('#EKRU')}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleReviewSubmit = async () => {
    if (!reviewRating) {
      setReviewError(t('productDetail.review.errors.ratingRequired'));
      return;
    }
    setReviewSaving(true);
    setReviewError('');
    setReviewSaved('');
    try {
      const result = await saveProductReview(
        product.id,
        reviewRating,
        reviewComment,
        reviewImages,
        keptReviewImageIds
      );
      setProduct((current) => (current ? { ...current, engagement: result.engagement } : current));
      setReviewRating(result.engagement.myReview?.rating ?? reviewRating);
      setReviewComment(result.engagement.myReview?.comment ?? '');
      setKeptReviewImageIds(result.engagement.myReview?.images.map((image) => image.id) ?? []);
      setReviewImages([]);
      setReviewEditing(false);
      setReviewSaved(result.message);
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : t('productDetail.review.errors.save')
      );
    } finally {
      setReviewSaving(false);
    }
  };

  const handleEditReview = () => {
    setReviewRating(engagement.myReview?.rating ?? null);
    setReviewComment(engagement.myReview?.comment ?? '');
    setKeptReviewImageIds(engagement.myReview?.images.map((image) => image.id) ?? []);
    setReviewImages([]);
    setReviewError('');
    setReviewSaved('');
    setReviewEditing(true);
  };

  const handleCancelReviewEdit = () => {
    setReviewRating(engagement.myReview?.rating ?? null);
    setReviewComment(engagement.myReview?.comment ?? '');
    setKeptReviewImageIds(engagement.myReview?.images.map((image) => image.id) ?? []);
    setReviewImages([]);
    setReviewError('');
    setReviewSaved('');
    setReviewEditing(false);
  };

  const handleReviewImages = (files: FileList | null) => {
    const selected = Array.from(files ?? []);
    const next = selected.filter(
      (file) =>
        ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) &&
        file.size <= 5 * 1024 * 1024
    );
    if (next.length !== selected.length) {
      setReviewError(t('productDetail.review.errors.image'));
    }
    const remaining = Math.max(0, 3 - keptReviewImageIds.length - reviewImages.length);
    setReviewImages((current) => [...current, ...next.slice(0, remaining)]);
  };

  const handleReplySubmit = async (review: MarketplaceProductReview) => {
    const comment = (replyDrafts[review.id] ?? review.reply?.comment ?? '').trim();
    if (!comment) {
      setReplyError(t('productDetail.review.errors.replyRequired'));
      setReplyErrorId(review.id);
      return;
    }
    setReplySavingId(review.id);
    setReplyError('');
    setReplyErrorId('');
    try {
      const result = await replyProductReview(product.id, review.id, comment);
      setProduct((current) => (current ? { ...current, engagement: result.engagement } : current));
      setReplyDrafts((current) => ({ ...current, [review.id]: comment }));
    } catch (error) {
      setReplyError(
        error instanceof Error ? error.message : t('productDetail.review.errors.reply')
      );
      setReplyErrorId(review.id);
    } finally {
      setReplySavingId('');
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const { files } = await getProductPreviewFiles(product.id);
      const preview = files.find((file) => file.url);
      if (!preview?.url) {
        setPreviewError(t('productDetail.preview.noFile'));
        return;
      }
      window.open(preview.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error.message : t('productDetail.preview.openError')
      );
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
    likes: 0,
    purchases: 0,
    downloads: 0,
    reviewCount: 0,
    averageRating: 0,
    reviews: [],
    canReview: false,
    canReply: false,
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
    ? t('productDetail.purchase.activeUntil', {
        date: new Intl.DateTimeFormat(currentLang.numberFormat.code, {
          dateStyle: 'medium',
          timeZone: 'Asia/Bangkok',
        }).format(new Date(activeSubscription)),
      })
    : purchaseUnavailable
      ? purchaseAccess?.hasPurchased
        ? t('productDetail.purchase.purchased')
        : t('productDetail.purchase.unavailable')
      : isInCart
        ? t('productDetail.purchase.inCart')
        : t('productDetail.purchase.addToCart');
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
      <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4, md: 7 } }}>
        {FACEBOOK_APP_ID && (
          <Script
            id="facebook-jssdk"
            src="https://connect.facebook.net/th_TH/sdk.js"
            strategy="afterInteractive"
            onReady={() => {
              window.FB?.init({
                appId: FACEBOOK_APP_ID,
                cookie: false,
                xfbml: false,
                version: FACEBOOK_API_VERSION,
              });
            }}
          />
        )}
        <Stack spacing={{ xs: 3, md: 4 }}>
          {product.status === 'archived' && (
            <Alert severity="info">{t('productDetail.archivedNotice')}</Alert>
          )}
          <Typography
            component="h1"
            variant="h3"
            sx={{ pr: { xs: 6.5, sm: 7 }, overflowWrap: 'anywhere' }}
          >
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
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{ width: { xs: 1, md: 'auto' }, minWidth: 0 }}
            >
              {sellerAvatar(50)}
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  {sellerName()}
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                  <Rating size="small" value={engagement.averageRating} precision={0.1} readOnly />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {engagement.reviewCount
                      ? t('productDetail.review.ratingSummary', {
                          rating: engagement.averageRating.toFixed(1),
                          count: engagement.reviewCount,
                        })
                      : t('productCard.new')}
                  </Typography>
                </Stack>
              </Box>
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ width: { xs: 1, md: 'auto' }, minWidth: 0 }}
            >
              <IconButton
                aria-label={
                  favorite
                    ? t('productDetail.actions.unfavorite')
                    : t('productDetail.actions.favorite')
                }
                disabled={collectionSaving}
                onClick={() => handleCollectionChange('favorite', favorite)}
                sx={{
                  border: '1px solid',
                  borderColor: favorite ? 'primary.main' : 'divider',
                  color: favorite ? 'primary.main' : 'text.primary',
                }}
              >
                {favorite ? <RiHeartFill /> : <RiHeartLine />}
              </IconButton>
              <IconButton
                aria-label={
                  saved ? t('productDetail.actions.unsave') : t('productDetail.actions.save')
                }
                disabled={collectionSaving}
                onClick={() => handleCollectionChange('bookmark', saved)}
                sx={{
                  border: '1px solid',
                  borderColor: saved ? 'primary.main' : 'divider',
                  color: saved ? 'primary.main' : 'text.primary',
                }}
              >
                {saved ? <RiBookmarkFill /> : <RiBookmarkLine />}
              </IconButton>
              <IconButton
                aria-label={t('productDetail.share.title')}
                aria-haspopup="dialog"
                aria-expanded={Boolean(shareAnchorEl)}
                onClick={(event) => setShareAnchorEl(event.currentTarget)}
                sx={{ border: '1px solid', borderColor: 'divider' }}
              >
                <RiShareForwardLine />
              </IconButton>
              <Popover
                open={Boolean(shareAnchorEl)}
                anchorEl={shareAnchorEl}
                onClose={() => setShareAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                  paper: {
                    sx: {
                      p: 2,
                      mt: 1,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      boxShadow: 8,
                    },
                  },
                }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                  {t('productDetail.share.title')}
                </Typography>
                <Stack direction="row" spacing={2}>
                  {[
                    {
                      label: 'LINE',
                      button: (
                        <LineShareButton
                          url={shareUrl}
                          title={content.title}
                          disabled={!shareUrl}
                          aria-label={t('productDetail.share.line')}
                        >
                          <LineIcon size={40} round aria-hidden="true" />
                        </LineShareButton>
                      ),
                    },
                    {
                      label: 'Facebook',
                      button: (
                        <IconButton
                          type="button"
                          disabled={!shareUrl}
                          onClick={handleFacebookShare}
                          aria-label={t('productDetail.share.facebook')}
                          sx={{ p: 0 }}
                        >
                          <FacebookIcon size={40} round aria-hidden="true" />
                        </IconButton>
                      ),
                    },
                    {
                      label: t('productDetail.share.emailLabel'),
                      button: (
                        <EmailShareButton
                          url={shareUrl}
                          subject={content.title}
                          body={t('productDetail.share.emailBody', { title: content.title })}
                          disabled={!shareUrl}
                          aria-label={t('productDetail.share.email')}
                        >
                          <EmailIcon size={40} round aria-hidden="true" />
                        </EmailShareButton>
                      ),
                    },
                  ].map((option) => (
                    <Box
                      key={option.label}
                      onClick={() => setShareAnchorEl(null)}
                      sx={{ minWidth: 52, textAlign: 'center' }}
                    >
                      {option.button}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 0.25, display: 'block' }}
                      >
                        {option.label}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Popover>
              <Button
                size="large"
                variant="contained"
                disabled={isInCart || purchaseUnavailable}
                startIcon={<RiAddLine />}
                onClick={handleAdd}
                color="primary"
                sx={{
                  minWidth: 0,
                  flex: { xs: 1, md: 'initial' },
                  borderRadius: 6,
                  px: { xs: 1.25, sm: 3 },
                  lineHeight: 1.35,
                  '& .MuiButton-startIcon': {
                    mr: { xs: 0.5, sm: 1 },
                  },
                }}
              >
                {addButtonLabel}
              </Button>
            </Stack>
          </Stack>

          <Box
            sx={{
              p: coverUrl ? 0 : { xs: 1.5, sm: 3, md: 5 },
              minHeight: coverUrl ? 0 : { xs: 280, md: 640 },
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
                  height: 'auto',
                  display: 'block',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <Stack spacing={2} alignItems="center" color="primary.main">
                <RiBookOpenLine size={110} />
                <Typography variant="h4">{t('productDetail.preview.placeholder')}</Typography>
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
                  <Chip
                    label={product.media_type?.name ?? t('productDetail.resource.teachingResource')}
                    variant="outlined"
                  />
                  {product.subject_label && (
                    <Chip label={product.subject_label} variant="outlined" />
                  )}
                </Stack>
                <Box>
                  <Typography variant="h4">{t('productDetail.about')}</Typography>
                  <Markdown
                    sx={{
                      mt: 1.5,
                      color: 'text.secondary',
                      lineHeight: 1.9,
                      overflowWrap: 'anywhere',
                      '& > :first-of-type': { mt: 0 },
                      '& > :last-child': { mb: 0 },
                    }}
                  >
                    {content.description}
                  </Markdown>
                </Box>
                {!!purchaseBenefits.length && (
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 2.5,
                      bgcolor: 'success.lighter',
                      border: '1px solid',
                      borderColor: 'success.light',
                    }}
                  >
                    <Typography variant="h5" sx={{ mb: 1.5 }}>
                      {t('productDetail.purchaseBenefits')}
                    </Typography>
                    <Stack spacing={1.25}>
                      {purchaseBenefits.map((benefit, index) => (
                        <Stack
                          key={`${benefit}-${index}`}
                          direction="row"
                          spacing={1}
                          alignItems="flex-start"
                        >
                          <RiCheckboxCircleLine
                            size={20}
                            color="#16A34A"
                            style={{ flexShrink: 0, marginTop: 2 }}
                          />
                          <Typography variant="body2">{benefit}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('productCard.price')}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="h3" color="primary.main" sx={{ mt: 0.5 }}>
                    {formatPrice(pricing.salePrice, product.currency)}
                  </Typography>
                  {pricing.hasDiscount && (
                    <Chip
                      color="error"
                      label={t('productDetail.pricing.discount', {
                        percent: pricing.discountPercent,
                      })}
                    />
                  )}
                </Stack>
                {pricing.hasDiscount && (
                  <Typography
                    color="text.disabled"
                    sx={{ mt: 0.25, textDecoration: 'line-through' }}
                  >
                    {t('productDetail.pricing.listPrice', {
                      price: formatPrice(pricing.listPrice, product.currency),
                    })}
                  </Typography>
                )}
                <Stack direction="row" spacing={2.5} sx={{ my: 2.5 }}>
                  <Box>
                    <Typography variant="subtitle1">
                      {engagement.views.toLocaleString(currentLang.numberFormat.code)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('productDetail.stats.visitors')}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle1">
                      {engagement.purchases.toLocaleString(currentLang.numberFormat.code)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('productDetail.stats.purchases')}
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
                  {t('productDetail.actions.goToCart')}
                </Button>
              </Card>
            </Grid>
          </Grid>

          <Divider />

          {!!modalProductHighlights.length && (
            <>
              <Box component="section" aria-labelledby="product-highlights-title">
                <Typography id="product-highlights-title" variant="h4" sx={{ mb: 2.5 }}>
                  {t('productDetail.highlights.title')}
                </Typography>
                <Grid container spacing={2}>
                  {modalProductHighlights.map((highlight) => (
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
            </>
          )}

          <Box component="section" aria-labelledby="product-reviews-title">
            <Typography id="product-reviews-title" variant="h4" sx={{ mb: 2.5 }}>
              {t('productDetail.review.title')}
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
                        {t('productDetail.review.fromReviews', {
                          count: engagement.reviewCount,
                          formattedCount: engagement.reviewCount.toLocaleString(
                            currentLang.numberFormat.code
                          ),
                        })}
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
                              <Typography variant="h6">
                                {t('productDetail.review.yourReview')}
                              </Typography>
                              <Button size="small" variant="outlined" onClick={handleEditReview}>
                                {t('productDetail.review.edit')}
                              </Button>
                            </Stack>
                            <Rating value={engagement.myReview.rating} readOnly />
                            <Typography
                              color={
                                engagement.myReview.comment ? 'text.primary' : 'text.secondary'
                              }
                              sx={{ whiteSpace: 'pre-line' }}
                            >
                              {engagement.myReview.comment || t('productDetail.review.noComment')}
                            </Typography>
                            <ReviewImages images={engagement.myReview.images} />
                            <Typography variant="caption" color="text.secondary">
                              {t('productDetail.review.lastEdited', {
                                date: new Intl.DateTimeFormat(currentLang.numberFormat.code, {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                  timeZone: 'Asia/Bangkok',
                                }).format(new Date(engagement.myReview.updated_at)),
                              })}
                            </Typography>
                            {reviewSaved && <Alert severity="success">{reviewSaved}</Alert>}
                          </Stack>
                        </Box>
                      ) : (
                        <>
                          <Typography variant="h6">
                            {engagement.myReview
                              ? t('productDetail.review.editYours')
                              : t('productDetail.review.rateProduct')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('productDetail.review.formDescription')}
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
                            label={t('productDetail.review.commentLabel')}
                            placeholder={t('productDetail.review.commentPlaceholder')}
                            inputProps={{ maxLength: 1000 }}
                            helperText={t('productDetail.review.characterCount', {
                              count: reviewComment.length,
                            })}
                            onChange={(event) => setReviewComment(event.target.value)}
                          />
                          <ReviewImageEditor
                            existingImages={engagement.myReview?.images ?? []}
                            keptImageIds={keptReviewImageIds}
                            newImages={reviewImages}
                            newImagePreviews={reviewImagePreviews}
                            disabled={reviewSaving}
                            onFiles={handleReviewImages}
                            onRemoveExisting={(imageId) =>
                              setKeptReviewImageIds((current) =>
                                current.filter((id) => id !== imageId)
                              )
                            }
                            onRemoveNew={(index) =>
                              setReviewImages((current) =>
                                current.filter((_image, imageIndex) => imageIndex !== index)
                              )
                            }
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
                                ? t('productDetail.review.saving')
                                : engagement.myReview
                                  ? t('productDetail.review.saveChanges')
                                  : t('productDetail.review.publish')}
                            </Button>
                            {engagement.myReview && (
                              <Button
                                color="inherit"
                                variant="outlined"
                                disabled={reviewSaving}
                                onClick={handleCancelReviewEdit}
                              >
                                {t('productDetail.actions.cancel')}
                              </Button>
                            )}
                          </Stack>
                        </>
                      )
                    ) : (
                      <Alert severity="info">{t('productDetail.review.buyersOnly')}</Alert>
                    )}
                  </Stack>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 7 }}>
                <Stack spacing={2}>
                  {engagement.reviews.length ? (
                    engagement.reviews.map((review) => (
                      <ReviewCard
                        key={review.id}
                        review={review}
                        canReply={engagement.canReply}
                        replyValue={replyDrafts[review.id] ?? review.reply?.comment ?? ''}
                        replySaving={replySavingId === review.id}
                        replyError={replyErrorId === review.id ? replyError : ''}
                        onReplyChange={(value) =>
                          setReplyDrafts((current) => ({ ...current, [review.id]: value }))
                        }
                        onReply={() => handleReplySubmit(review)}
                      />
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
                          {t('productCard.noReviews')}
                        </Typography>
                        <Typography color="text.secondary">
                          {t('productDetail.review.beFirst')}
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
                {product.seller?.bio || t('productDetail.seller.defaultBio')}
              </Typography>
              {!!storeHref && (
                <Button
                  component={RouterLink}
                  href={storeHref}
                  color="inherit"
                  variant="contained"
                  sx={{ mt: 1, px: 3, borderRadius: 6 }}
                >
                  {t('productDetail.seller.viewProfile')}
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
              <Stack direction="column">
                <Typography variant="h5">{t('productDetail.seller.moreFrom')}</Typography>
                <MarketplaceSellerLink
                  seller={product.seller}
                  showAvatar={false}
                  nameVariant="h5"
                  fallbackName={t('productDetail.seller.thisStore')}
                />
              </Stack>
              {!!storeHref && (
                <Button
                  component={RouterLink}
                  href={storeHref}
                  color="inherit"
                  sx={{ flexShrink: 0 }}
                >
                  {t('productDetail.seller.viewAll')}
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
                        <Typography variant="subtitle1" color="primary.main" sx={{ mt: 0.5 }}>
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
                <Typography color="text.secondary">
                  {t('productDetail.seller.noMoreProducts')}
                </Typography>
              </Box>
            )}
          </Box>

          {(relatedProductsLoading || visibleRelatedProducts.length > 0) && (
            <Box
              component="section"
              aria-labelledby="related-products-modal-title"
              sx={{ pt: { xs: 4, md: 6 }, borderTop: '1px solid', borderColor: 'divider' }}
            >
              <Typography id="related-products-modal-title" variant="h4">
                {t('productDetail.related.title')}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75, mb: 3 }}>
                {t('productDetail.related.description')}
              </Typography>

              {relatedProductsLoading ? (
                <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
                  <CircularProgress />
                </Box>
              ) : (
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
                              fallbackName={t('productDetail.seller.fallback')}
                              nameSx={{ color: 'text.secondary' }}
                            />
                          </Stack>
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </Box>
          )}
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3 } }}>
      <Button
        component={RouterLink}
        href="/products"
        color="inherit"
        startIcon={<RiArrowLeftLine />}
      >
        {t('productDetail.actions.backToMarketplace')}
      </Button>

      {product.status === 'archived' && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t('productDetail.archivedNotice')}
        </Alert>
      )}

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
              {product.resource_type === 'digital' && product.has_preview_file && (
                <Button
                  fullWidth
                  variant="outlined"
                  disabled={previewLoading}
                  startIcon={<RiEyeLine />}
                  onClick={handlePreview}
                >
                  {previewLoading
                    ? t('productDetail.preview.opening')
                    : t('productDetail.preview.viewFile')}
                </Button>
              )}
              {previewError && <Alert severity="info">{previewError}</Alert>}
            </Stack>
          </Stack>

          <Box sx={{ mt: 4 }}>
            <Typography variant="h4" sx={{ mb: 1.5 }}>
              {t('productDetail.details')}
            </Typography>
            <Markdown
              sx={{
                color: 'text.secondary',
                lineHeight: 1.9,
                overflowWrap: 'anywhere',
                '& > :first-of-type': { mt: 0 },
                '& > :last-child': { mb: 0 },
              }}
            >
              {content.description}
            </Markdown>
          </Box>

          {!!purchaseBenefits.length && (
            <Box
              sx={{
                p: { xs: 2, sm: 2.5 },
                mt: 4,
                borderRadius: 2.5,
                bgcolor: 'success.lighter',
                border: '1px solid',
                borderColor: 'success.light',
              }}
            >
              <Typography variant="h5" sx={{ mb: 1.5 }}>
                {t('productDetail.purchaseBenefits')}
              </Typography>
              <Stack spacing={1.25}>
                {purchaseBenefits.map((benefit, index) => (
                  <Stack
                    key={`${benefit}-${index}`}
                    direction="row"
                    spacing={1}
                    alignItems="flex-start"
                  >
                    <RiCheckboxCircleLine
                      size={20}
                      color="#16A34A"
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />
                    <Typography variant="body2">{benefit}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2.5} sx={{ position: { md: 'sticky' }, top: { md: 96 } }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={product.category} color="primary" variant="soft" />
              <Chip
                label={
                  product.media_type?.name ??
                  (product.resource_type === 'digital'
                    ? t('productDetail.resource.digital')
                    : product.resource_type === 'service'
                      ? t('productDetail.resource.service')
                      : t('productDetail.resource.physical'))
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
                  ? t('productDetail.review.ratingParentheses', {
                      rating: engagement.averageRating.toFixed(1),
                      count: engagement.reviewCount,
                    })
                  : t('productCard.noReviews')}
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
                {product.seller?.seller_type === 'teacher' ? (
                  <Typography variant="caption" color="text.secondary">
                    {t('productDetail.seller.verified')}
                  </Typography>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    {t('productDetail.seller.official')}
                  </Typography>
                )}
              </Box>
            </Stack>

            <Typography variant="h3" color="primary.main">
              {formatPrice(pricing.salePrice, product.currency)}
            </Typography>

            <Stack
              direction="row"
              spacing={{ xs: 2, sm: 2.5 }}
              alignItems="center"
              sx={{
                px: 1.5,
                py: 1.25,
                width: 'fit-content',
                maxWidth: 1,
                borderRadius: 2,
                color: 'text.secondary',
                bgcolor: 'background.neutral',
              }}
            >
              {[
                {
                  label: t('productCard.views'),
                  value: engagement.views,
                  icon: <RiEyeLine size={20} />,
                },
                {
                  label: t('productCard.likes'),
                  value: engagement.likes,
                  icon: <RiHeartLine size={19} />,
                },
                {
                  label: t('productCard.orders'),
                  value: engagement.purchases,
                  icon: <RiShoppingBag3Line size={19} />,
                },
              ].map((stat) => (
                <Stack
                  key={stat.label}
                  direction="row"
                  spacing={0.625}
                  alignItems="center"
                  aria-label={`${stat.label} ${stat.value.toLocaleString(currentLang.numberFormat.code)}`}
                  title={stat.label}
                >
                  <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}>
                    {stat.icon}
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 700 }}>
                    {stat.value.toLocaleString(currentLang.numberFormat.code)}
                  </Typography>
                </Stack>
              ))}
            </Stack>

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
                {t('productDetail.actions.goToCart')}
              </Button>
            </Stack>

            {purchaseUnavailable && purchaseAccess?.message && (
              <Alert severity="info">{purchaseAccess.message}</Alert>
            )}

            {product.resource_type === 'feature_unlock' && (
              <Alert severity="info" icon={<RiShieldCheckLine />}>
                <Typography variant="subtitle2">
                  {product.license_scope === 'individual'
                    ? t('productDetail.license.individual')
                    : product.license_scope === 'teacher'
                      ? t('productDetail.license.teacher', {
                          count: product.license_seat_count ?? 1,
                        })
                      : product.license_scope === 'platform'
                        ? t('productDetail.license.platform')
                        : t('productDetail.license.school')}
                </Typography>
                <Typography variant="body2">
                  {product.license_target_system === 'marketplace'
                    ? t('productDetail.license.targetMarketplace')
                    : t('productDetail.license.targetEkru')}{' '}
                  ·{' '}
                  {product.grant_duration_days == null
                    ? 'ซื้อขาด · ไม่มีวันหมดอายุ'
                    : product.license_billing_cycle === 'monthly'
                      ? 'รายเดือน · ตัดบัตรอัตโนมัติ'
                      : product.license_billing_cycle === 'yearly'
                        ? 'รายปี · ตัดบัตรอัตโนมัติ'
                        : product.license_billing_cycle === 'contract'
                          ? `ตามสัญญา ${product.grant_duration_days} วัน`
                          : t('productDetail.license.days', {
                              count: product.grant_duration_days,
                            })}{' '}
                  ·{' '}
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

            {!!productHighlights.length && (
              <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
                <Typography variant="h5" sx={{ mb: 2.25 }}>
                  {t('productDetail.highlights.title')}
                </Typography>
                <Stack spacing={2}>
                  {productHighlights.map((item) => (
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
            )}

            <Grid container spacing={1}>
              {[
                {
                  label: t('productDetail.stats.visitors'),
                  value: engagement.views,
                  icon: <RiEyeLine />,
                },
                {
                  label: t('productDetail.stats.purchases'),
                  value: engagement.purchases,
                  icon: <RiShoppingBag3Line />,
                },
                {
                  label: t('productDetail.stats.downloads'),
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
                      {stat.value.toLocaleString(currentLang.numberFormat.code)}
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
                  {engagement.myReview
                    ? t('productDetail.review.editYours')
                    : t('productDetail.review.rateProduct')}
                </Typography>
              </Stack>
              {engagement.canReview ? (
                <>
                  <Typography color="text.secondary">
                    {t('productDetail.review.shareExperience')}
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
                    label={t('productDetail.review.optionalLabel')}
                    inputProps={{ maxLength: 1000 }}
                    helperText={`${reviewComment.length}/1,000`}
                    onChange={(event) => setReviewComment(event.target.value)}
                  />
                  <ReviewImageEditor
                    existingImages={engagement.myReview?.images ?? []}
                    keptImageIds={keptReviewImageIds}
                    newImages={reviewImages}
                    newImagePreviews={reviewImagePreviews}
                    disabled={reviewSaving}
                    onFiles={handleReviewImages}
                    onRemoveExisting={(imageId) =>
                      setKeptReviewImageIds((current) => current.filter((id) => id !== imageId))
                    }
                    onRemoveNew={(index) =>
                      setReviewImages((current) =>
                        current.filter((_image, imageIndex) => imageIndex !== index)
                      )
                    }
                  />
                  {reviewError && <Alert severity="error">{reviewError}</Alert>}
                  {reviewSaved && <Alert severity="success">{reviewSaved}</Alert>}
                  <Button
                    variant="contained"
                    disabled={!reviewRating || reviewSaving}
                    onClick={handleReviewSubmit}
                  >
                    {reviewSaving
                      ? t('productDetail.review.saving')
                      : t('productDetail.review.save')}
                  </Button>
                </>
              ) : (
                <Alert severity="info">{t('productDetail.review.buyersOnly')}</Alert>
              )}
            </Stack>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={2.5}>
            <Typography variant="h4">{t('productDetail.review.fromBuyers')}</Typography>
            {engagement.reviews.length ? (
              engagement.reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  canReply={engagement.canReply}
                  replyValue={replyDrafts[review.id] ?? review.reply?.comment ?? ''}
                  replySaving={replySavingId === review.id}
                  replyError={replyErrorId === review.id ? replyError : ''}
                  onReplyChange={(value) =>
                    setReplyDrafts((current) => ({ ...current, [review.id]: value }))
                  }
                  onReply={() => handleReplySubmit(review)}
                />
              ))
            ) : (
              <Card variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
                <RiStarLine size={36} />
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {t('productDetail.review.emptyCombined')}
                </Typography>
              </Card>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

function ReviewImages({ images }: { images: MarketplaceProductReview['images'] }) {
  const { t } = useTranslate('marketplace');
  if (!images.length) return null;
  return (
    <Box
      sx={{
        gap: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      }}
    >
      {images.map((image) => (
        <Box
          key={image.id}
          component="a"
          href={image.url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: 'block' }}
        >
          <Box
            component="img"
            src={image.url}
            alt={t('productDetail.review.imageAlt')}
            sx={{
              width: 1,
              height: 104,
              display: 'block',
              objectFit: 'cover',
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          />
        </Box>
      ))}
    </Box>
  );
}

function ReviewImageEditor({
  existingImages,
  keptImageIds,
  newImages,
  newImagePreviews,
  disabled,
  onFiles,
  onRemoveExisting,
  onRemoveNew,
}: {
  existingImages: MarketplaceProductReview['images'];
  keptImageIds: string[];
  newImages: File[];
  newImagePreviews: string[];
  disabled: boolean;
  onFiles: (files: FileList | null) => void;
  onRemoveExisting: (id: string) => void;
  onRemoveNew: (index: number) => void;
}) {
  const { t } = useTranslate('marketplace');
  const keptImages = existingImages.filter((image) => keptImageIds.includes(image.id));
  const total = keptImages.length + newImages.length;

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          component="label"
          variant="outlined"
          startIcon={<RiImageAddLine />}
          disabled={disabled || total >= 3}
        >
          {t('productDetail.review.addImages')}
          <input
            hidden
            multiple
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              onFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </Button>
        <Typography variant="caption" color="text.secondary">
          {t('productDetail.review.imageLimit', { total })}
        </Typography>
      </Stack>
      {total > 0 && (
        <Box
          sx={{
            gap: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          }}
        >
          {keptImages.map((image) => (
            <ReviewImagePreview
              key={image.id}
              src={image.url}
              onRemove={() => onRemoveExisting(image.id)}
            />
          ))}
          {newImagePreviews.map((preview, index) => (
            <ReviewImagePreview
              key={`${newImages[index]?.name ?? 'image'}-${index}`}
              src={preview}
              onRemove={() => onRemoveNew(index)}
            />
          ))}
        </Box>
      )}
    </Stack>
  );
}

function ReviewImagePreview({ src, onRemove }: { src: string; onRemove: () => void }) {
  const { t } = useTranslate('marketplace');
  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        component="img"
        src={src}
        alt={t('productDetail.review.imagePreviewAlt')}
        sx={{ width: 1, height: 96, display: 'block', objectFit: 'cover', borderRadius: 1.5 }}
      />
      <IconButton
        size="small"
        color="error"
        aria-label={t('productDetail.review.removeImage')}
        onClick={onRemove}
        sx={{
          top: 4,
          right: 4,
          position: 'absolute',
          color: 'common.white',
          bgcolor: 'error.main',
          '&:hover': { bgcolor: 'error.dark' },
        }}
      >
        <RiCloseLine size={16} />
      </IconButton>
    </Box>
  );
}

function ReviewCard({
  review,
  canReply,
  replyValue,
  replySaving,
  replyError,
  onReplyChange,
  onReply,
}: {
  review: MarketplaceProductReview;
  canReply: boolean;
  replyValue: string;
  replySaving: boolean;
  replyError: string;
  onReplyChange: (value: string) => void;
  onReply: () => void;
}) {
  const { t, currentLang } = useTranslate('marketplace');
  return (
    <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
          <Typography variant="subtitle1">{review.reviewer_name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {new Intl.DateTimeFormat(currentLang.numberFormat.code, {
              dateStyle: 'medium',
              timeZone: 'Asia/Bangkok',
            }).format(new Date(review.updated_at))}
          </Typography>
        </Stack>
        <Rating size="small" value={review.rating} readOnly />
        {review.comment && (
          <Typography color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
            {review.comment}
          </Typography>
        )}
        <ReviewImages images={review.images} />

        {review.reply && (
          <Box
            sx={{
              p: 2,
              ml: { sm: 2 },
              borderRadius: 2,
              bgcolor: 'background.neutral',
              borderLeft: '3px solid',
              borderColor: 'primary.main',
            }}
          >
            <Typography variant="subtitle2">
              {t('productDetail.review.replyFrom', { name: review.reply.responder_name })}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5, whiteSpace: 'pre-line' }}
            >
              {review.reply.comment}
            </Typography>
          </Box>
        )}

        {canReply && (
          <Stack spacing={1}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label={
                review.reply ? t('productDetail.review.editReply') : t('productDetail.review.reply')
              }
              value={replyValue}
              inputProps={{ maxLength: 1000 }}
              helperText={`${replyValue.length}/1,000`}
              onChange={(event) => onReplyChange(event.target.value)}
            />
            {replyError && <Alert severity="error">{replyError}</Alert>}
            <Button
              variant="contained"
              disabled={!replyValue.trim() || replySaving}
              onClick={onReply}
              sx={{ alignSelf: 'flex-start' }}
            >
              {replySaving
                ? t('productDetail.review.saving')
                : review.reply
                  ? t('productDetail.review.saveReply')
                  : t('productDetail.review.replyAction')}
            </Button>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
