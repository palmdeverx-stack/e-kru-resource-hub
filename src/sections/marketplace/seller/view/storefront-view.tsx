'use client';

import type { MarketplaceSeller, MarketplaceProduct } from '../../shared/types';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import ClickAwayListener from '@mui/material/ClickAwayListener';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';
import { brandColors } from 'src/theme/brand-colors';
import { apiFetch as fetch } from 'src/lib/api-fetch';

import {
  RiStore2Line,
  RiArrowLeftLine,
  RiShieldStarFill,
  RiShoppingBag3Line,
  RiVerifiedBadgeFill,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { hasAnalyticsConsent } from '../../legal/cookie-consent';
import { MarketplaceProductCard } from '../../shared/product-card';
import { MarketplaceSellerBadges } from '../../shared/seller-badges';
import { isSystemMarketplaceSeller } from '../../shared/seller-completion';
import { MarketplaceProductDetailDialog } from '../../catalog/components/product-detail-dialog';

type Props = {
  slug: string;
  dashboardMode?: boolean;
};

const VISITOR_STORAGE_KEY = 'ekru_marketplace_visitor_id';

export function MarketplaceStorefrontView({ slug, dashboardMode = false }: Props) {
  const { t, currentLang } = useTranslate('marketplace');
  const { user } = useAuthContext();
  const theme = useTheme();
  const [seller, setSeller] = useState<MarketplaceSeller | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const [category, setCategory] = useState('all');
  const [error, setError] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch(`/api/marketplace/stores/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        if (controller.signal.aborted) return;
        setSeller(result.seller);
        setProducts(result.products);
        if (hasAnalyticsConsent()) {
          let visitorId = window.localStorage.getItem(VISITOR_STORAGE_KEY);
          if (!visitorId) {
            visitorId = window.crypto.randomUUID();
            window.localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
          }
          fetch(`/api/marketplace/stores/${encodeURIComponent(slug)}/view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visitorId }),
            signal: controller.signal,
          }).catch(() => undefined);
        }
      })
      .catch((requestError) => {
        if ((requestError as Error).name !== 'AbortError') setError(true);
      });
    return () => controller.abort();
  }, [slug]);

  const categories = useMemo(
    () => ['all', ...new Set(products.map((product) => product.category).filter(Boolean))],
    [products]
  );
  const visibleProducts = useMemo(
    () =>
      category === 'all' ? products : products.filter((product) => product.category === category),
    [category, products]
  );
  const totalReviews = products.reduce(
    (total, product) => total + (product.engagement?.reviewCount ?? 0),
    0
  );

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 10 }}>
        <Alert severity="error">{t('storefront.errors.load')}</Alert>
      </Container>
    );
  }

  if (!seller) {
    return (
      <Box sx={{ minHeight: 500, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const numberLocale = currentLang.numberFormat.code;
  const storeName =
    currentLang.value === 'en' && seller.display_name_en?.trim()
      ? seller.display_name_en
      : seller.display_name;
  const alternateStoreName =
    currentLang.value === 'en' ? seller.display_name : seller.display_name_en;

  return (
    <Container
      maxWidth={dashboardMode ? false : 'lg'}
      sx={{ py: { xs: 3, md: dashboardMode ? 3 : 7 } }}
    >
      {!dashboardMode && (
        <Button
          component={RouterLink}
          href={paths.marketplace.stores}
          startIcon={<RiArrowLeftLine />}
          color="inherit"
          sx={{ mb: 2, whiteSpace: 'nowrap' }}
        >
          {t('storefront.backToStores')}
        </Button>
      )}
      <Card
        variant="outlined"
        sx={{
          p: { xs: 2.5, md: 4 },
          overflow: 'hidden',
          borderRadius: 4,
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{
            width: 1,
            aspectRatio: '16 / 4',
            mb: 0,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 3,
            bgcolor: 'primary.darker',
            backgroundImage: seller.cover_url
              ? `url(${JSON.stringify(seller.cover_url)})`
              : brandColors.featureBackground,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {!seller.cover_url && (
            <>
              <Box
                sx={{
                  inset: 0,
                  position: 'absolute',
                  background:
                    'linear-gradient(180deg, transparent 35%, rgba(2, 29, 34, 0.82) 100%)',
                }}
              />
              <Stack
                spacing={1}
                sx={{
                  left: 28,
                  right: 28,
                  bottom: 26,
                  zIndex: 1,
                  position: 'absolute',
                  color: 'common.white',
                }}
              >
                <Typography variant="h4">{t('storefront.banner.title', { storeName })}</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.76)' }}>
                  {t('storefront.banner.description')}
                </Typography>
              </Stack>
            </>
          )}
        </Box>

        <Grid container spacing={{ xs: 4, lg: 7 }} alignItems="stretch">
          <Grid size={{ xs: 12 }}>
            <Stack
              sx={{ height: 1, px: { xs: 0, md: 1 } }}
              justifyContent="center"
              alignItems="flex-start"
            >
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
                sx={{
                  mb: 2,
                  mt: { xs: '-36px', md: '-44px' },
                  ml: { xs: 2, md: 3 },
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <Avatar
                  src={seller.logo_url ?? undefined}
                  alt={storeName}
                  sx={{
                    width: { xs: 72, md: 88 },
                    height: { xs: 72, md: 88 },
                    bgcolor: 'primary.lighter',
                    color: 'primary.main',
                    border: '4px solid',
                    borderColor: 'background.paper',
                    boxShadow: 2,
                    flexShrink: 0,
                  }}
                >
                  <RiStore2Line size={38} />
                </Avatar>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' },
                  gap: { xs: 3, md: 4 },
                  width: 1,
                  alignItems: 'start',
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography
                      component="h1"
                      variant="h3"
                      sx={{ fontSize: { xs: 26, md: 34 }, overflowWrap: 'anywhere' }}
                    >
                      {storeName}
                    </Typography>
                    <ClickAwayListener onClickAway={() => setVerificationOpen(false)}>
                      <Tooltip
                        title={t('storefront.verifiedStore')}
                        arrow
                        open={verificationOpen}
                        onOpen={() => setVerificationOpen(true)}
                        onClose={() => setVerificationOpen(false)}
                        disableTouchListener
                      >
                        <IconButton
                          size="small"
                          aria-label={t('storefront.verifiedStore')}
                          onClick={() => setVerificationOpen(true)}
                          sx={{ color: 'primary.main', flexShrink: 0 }}
                        >
                          <RiVerifiedBadgeFill size={24} />
                        </IconButton>
                      </Tooltip>
                    </ClickAwayListener>
                    {isSystemMarketplaceSeller(seller) && (
                      <RiShieldStarFill
                        size={26}
                        color={theme.palette.primary.main}
                        aria-label={t('storefront.systemStore')}
                      />
                    )}
                  </Stack>

                  {user?.role === 'master_admin' && isSystemMarketplaceSeller(seller) && (
                    <Button
                      component={RouterLink}
                      href={`${paths.marketplace.sellerProfileEdit}?sellerId=${encodeURIComponent(seller.id)}`}
                      variant="outlined"
                      sx={{ mt: 2, alignSelf: 'flex-start' }}
                    >
                      {t('storefront.editStore')}
                    </Button>
                  )}

                  {alternateStoreName && alternateStoreName !== storeName && (
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                      {alternateStoreName}
                    </Typography>
                  )}

                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{
                      mt: 1.5,
                      maxWidth: 760,
                      lineHeight: 1.8,
                      whiteSpace: 'pre-line',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {seller.bio || t('storefront.defaultBio')}
                  </Typography>


                </Box>
                <Box sx={{ minWidth: 0, pt: { md: 0.5 } }}>
                  <Stack
                    direction="row"
                    spacing={0}
                    sx={{
                      width: 1,
                      color: 'text.secondary',
                      bgcolor: 'background.neutral',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 2,
                      '& > .MuiBox-root': { flex: 1, minWidth: 0, px: 1, textAlign: 'center' },
                      '& > .MuiBox-root + .MuiBox-root': {
                        borderLeft: '1px solid',
                        borderColor: 'divider',
                      },
                    }}
                  >
                    <Box>
                      <Typography variant="h6" color="text.primary">
                        {products.length.toLocaleString(numberLocale)}
                      </Typography>
                      <Typography variant="body2">{t('storefront.stats.products')}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="h6" color="text.primary">
                        {totalReviews.toLocaleString(numberLocale)}
                      </Typography>
                      <Typography variant="body2">{t('storefront.stats.reviews')}</Typography>
                    </Box>
                    {!!seller.badges?.length && (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MarketplaceSellerBadges badges={seller.badges} limit={1} variant="seal" />
                      </Box>
                    )}
                  </Stack>
                </Box>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Card>

      <Box component="section" sx={{ pt: { xs: 5, md: 7 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography variant="h4">{t('storefront.products.heading')}</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              {t('storefront.products.found', {
                count: visibleProducts.length,
                formattedCount: visibleProducts.length.toLocaleString(numberLocale),
              })}
            </Typography>
          </Box>
          <Chip
            icon={<RiShoppingBag3Line />}
            label={t('storefront.products.count', {
              count: products.length,
              formattedCount: products.length.toLocaleString(numberLocale),
            })}
            variant="outlined"
          />
        </Stack>

        <Box
          component="nav"
          aria-label={t('storefront.categories.label')}
          sx={{ mt: 3, overflowX: 'auto' }}
        >
          <Stack direction="row" spacing={1} sx={{ width: 'max-content' }}>
            {categories.map((item) => {
              const active = item === category;
              return (
                <Button
                  key={item}
                  color={active ? 'primary' : 'inherit'}
                  variant={active ? 'contained' : 'text'}
                  onClick={() => setCategory(item)}
                  sx={{ px: 2.25, borderRadius: 8 }}
                >
                  {item === 'all' ? t('storefront.categories.all') : item}
                </Button>
              );
            })}
          </Stack>
        </Box>

        <Divider sx={{ my: 3 }} />

        {visibleProducts.length ? (
          <Grid container spacing={2.5}>
            {visibleProducts.map((product, index) => (
              <Grid
                key={product.id}
                size={{ xs: 12, sm: 6, md: 4 }}
                onClickCapture={
                  dashboardMode
                    ? (event) => {
                        if (
                          (event.target as HTMLElement).closest('[data-marketplace-seller-link]')
                        ) {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        setSelectedProduct(product);
                      }
                    : undefined
                }
              >
                <MarketplaceProductCard product={product} colorIndex={index} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Card variant="outlined" sx={{ py: 9, textAlign: 'center', borderRadius: 3 }}>
            <RiStore2Line size={42} />
            <Typography variant="h6" sx={{ mt: 1.5 }}>
              {t('storefront.empty.title')}
            </Typography>
            <Typography color="text.secondary">{t('storefront.empty.description')}</Typography>
          </Card>
        )}
      </Box>

      {dashboardMode && (
        <MarketplaceProductDetailDialog
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </Container>
  );
}
