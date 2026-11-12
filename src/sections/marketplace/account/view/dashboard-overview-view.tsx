'use client';

import type { MarketplaceProduct } from '../../shared/types';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import {
  RiHeart3Line,
  RiStore2Line,
  RiBookmarkLine,
  RiBookOpenLine,
  RiArrowRightLine,
  RiShoppingBag3Line,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { getProductCollections } from '../../shared/api';
import { MarketplaceProductCard } from '../../shared/product-card';

const MarketplaceProductDetailDialog = dynamic(() =>
  import('../../catalog/components/product-detail-dialog').then(
    (module) => module.MarketplaceProductDetailDialog
  )
);

const actions = [
  {
    title: 'dashboardUi.browseTeachingResources',
    description: 'dashboardUi.discoverWorksheetsLessonPlansAndNewResourcesFrom',
    href: paths.marketplace.dashboardProducts,
    icon: RiBookOpenLine,
    color: 'primary.lighter',
  },
  {
    title: 'dashboardUi.myPurchases',
    description: 'dashboardUi.checkOrdersAndDownloadYourPurchasedFiles',
    href: '/dashboard/purchases',
    icon: RiShoppingBag3Line,
    color: 'info.lighter',
  },
  {
    title: 'dashboardUi.myStore',
    description: 'dashboardUi.openAStoreListResourcesAndManageYour',
    href: '/dashboard/seller',
    icon: RiStore2Line,
    color: 'warning.lighter',
  },
] as const;

export function MarketplaceDashboardOverviewView() {
  const { t } = useTranslate('marketplace');
  const { user } = useAuthContext();
  const isPlatformAdmin = user?.role === 'master_admin' || user?.role === 'marketplace_admin';

  return (
    <>
      <Container maxWidth={false} sx={{ py: { xs: 3, md: 3 } }}>
        <Card
          sx={{
            p: { xs: 3, md: 4.5 },
            overflow: 'hidden',
            position: 'relative',
            borderRadius: 4,
            color: 'common.white',
            background: 'linear-gradient(125deg, #0B3B8F 0%, #1565F5 52%, #53A2FF 100%)',
          }}
        >
          <Box
            sx={{
              width: 260,
              height: 260,
              top: -130,
              right: -40,
              position: 'absolute',
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.10)',
            }}
          />
          <Chip
            label="E-KRU Marketplace"
            sx={{ mb: 2, color: 'common.white', bgcolor: 'rgba(255,255,255,0.16)' }}
          />
          <Typography component="h1" variant="h2" sx={{ position: 'relative' }}>
            {t('dashboardUi.greeting', { name: user?.displayName || user?.username || '' })}
          </Typography>
          <Typography sx={{ mt: 1, maxWidth: 620, color: 'rgba(255,255,255,0.78)' }}>
            {t('dashboardUi.discoverNewResourcesSaveYourFavoritesAndManage')}
          </Typography>
          <Button
            component={RouterLink}
            href={paths.marketplace.dashboardProducts}
            variant="contained"
            color="white"
            endIcon={<RiArrowRightLine />}
            sx={{ mt: 3, color: 'primary.darker', bgcolor: 'common.white' }}
          >
            {t('dashboardUi.browseAllResources')}
          </Button>
        </Card>

        <Grid container spacing={2.5} sx={{ mt: 3 }}>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Grid key={action.href} size={{ xs: 12, md: 4 }}>
                <Card variant="outlined" sx={{ p: 2.5, height: 1, borderRadius: 3 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        flexShrink: 0,
                        borderRadius: 2,
                        placeItems: 'center',
                        display: 'inline-grid',
                        bgcolor: action.color,
                      }}
                    >
                      <Icon size={25} />
                    </Box>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="subtitle1">{t(action.title)}</Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mt: 0.25,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {t(action.description)}
                      </Typography>
                    </Box>
                    <Button
                      component={RouterLink}
                      href={action.href}
                      color="inherit"
                      aria-label={t('dashboardUi.goTo', { title: t(action.title) })}
                      sx={{ minWidth: 36, px: 1 }}
                    >
                      <RiArrowRightLine />
                    </Button>
                  </Stack>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Container>

      {!isPlatformAdmin && <MarketplaceDashboardCollectionsSection />}
    </>
  );
}

export function MarketplaceDashboardCollectionsSection() {
  const { t, currentLang } = useTranslate('marketplace');
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const {
    data,
    isPending: loading,
    error,
  } = useQuery({
    queryKey: ['dashboard-collections', user?.id, user?.role],
    enabled: Boolean(user?.id),
    queryFn: ({ signal }) => getProductCollections({ signal }),
    staleTime: 30_000,
  });
  const favorites = data?.favorites ?? [];
  const bookmarks = data?.bookmarks ?? [];
  const [activeList, setActiveList] = useState<'favorite' | 'bookmark'>('favorite');
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  useEffect(() => {
    const invalidate = () => {
      void queryClient.invalidateQueries({
        queryKey: ['dashboard-collections', user?.id, user?.role],
      });
    };
    window.addEventListener('marketplace-collections-changed', invalidate);
    return () => window.removeEventListener('marketplace-collections-changed', invalidate);
  }, [queryClient, user?.id, user?.role]);

  const products = activeList === 'favorite' ? favorites : bookmarks;

  return (
    <Container maxWidth={false} sx={{ pb: { xs: 5, md: 7 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'flex-end' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4">{t('dashboardUi.yourSavedResources')}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {t('dashboardUi.findYourLikedAndBookmarkedResourcesHere')}
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          href={paths.marketplace.dashboardProducts}
          endIcon={<RiArrowRightLine />}
        >
          {t('dashboardUi.viewAllResources')}
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
        <Button
          variant={activeList === 'favorite' ? 'contained' : 'outlined'}
          color={activeList === 'favorite' ? 'error' : 'inherit'}
          startIcon={<RiHeart3Line />}
          onClick={() => setActiveList('favorite')}
          sx={{ borderRadius: 8 }}
        >
          {t('dashboardUi.likes', {
            count: favorites.length,
            formattedCount: favorites.length.toLocaleString(currentLang.numberFormat.code),
          })}
        </Button>
        <Button
          variant={activeList === 'bookmark' ? 'contained' : 'outlined'}
          color={activeList === 'bookmark' ? 'primary' : 'inherit'}
          startIcon={<RiBookmarkLine />}
          onClick={() => setActiveList('bookmark')}
          sx={{ borderRadius: 8 }}
        >
          {t('dashboardUi.bookmarks', {
            count: bookmarks.length,
            formattedCount: bookmarks.length.toLocaleString(currentLang.numberFormat.code),
          })}
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error.message}
        </Alert>
      )}
      {loading ? (
        <Box sx={{ minHeight: 260, display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      ) : products.length ? (
        <Grid container spacing={2.5}>
          {products.slice(0, 8).map((product, index) => (
            <Grid
              key={product.id}
              size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}
              onClickCapture={(event) => {
                if ((event.target as HTMLElement).closest('[data-marketplace-seller-link]')) return;
                event.preventDefault();
                event.stopPropagation();
                setSelectedProduct(product);
              }}
            >
              <MarketplaceProductCard product={product} colorIndex={index} />
            </Grid>
          ))}
        </Grid>
      ) : (
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
            {activeList === 'favorite' ? <RiHeart3Line size={46} /> : <RiBookmarkLine size={46} />}
          </Box>
          <Typography variant="h6" sx={{ mt: 3 }}>
            {activeList === 'favorite'
              ? t('dashboardUi.noLikedResourcesYet')
              : t('dashboardUi.noBookmarkedResourcesYet')}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
            {t('dashboardUi.likeOrBookmarkAResourceOnItsDetails')}
          </Typography>
          <Button
            component={RouterLink}
            href={paths.marketplace.dashboardProducts}
            variant="contained"
            color="primary"
          >
            {t('dashboardUi.browseResources')}
          </Button>
        </Card>
      )}

      {selectedProduct && (
        <MarketplaceProductDetailDialog
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </Container>
  );
}
