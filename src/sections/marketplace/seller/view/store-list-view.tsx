'use client';

import type { MarketplaceSeller } from '../../shared/types';

import { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Rating from '@mui/material/Rating';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Pagination from '@mui/material/Pagination';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';
import { apiFetch as fetch } from 'src/lib/api-fetch';

import {
  RiEyeLine,
  RiCloseLine,
  RiSearchLine,
  RiStore2Line,
  RiArrowRightLine,
  RiShieldStarFill,
  RiShoppingBag3Line,
  RiVerifiedBadgeFill,
} from 'src/components/remix-icon';

import { MarketplaceSellerBadges } from '../../shared/seller-badges';
import { isSellerProfileVerified } from '../../shared/seller-completion';

type PublicStore = Pick<
  MarketplaceSeller,
  | 'id'
  | 'display_name'
  | 'display_name_en'
  | 'slug'
  | 'logo_url'
  | 'cover_url'
  | 'bio'
  | 'seller_type'
  | 'profile_completion'
  | 'is_system_store'
  | 'badges'
> & {
  product_count: number;
  view_count: number;
  review_count: number;
  average_rating: number;
};

type StoreResponse = {
  updatedAt?: string;
  stores: PublicStore[];
  total: number;
  page: number;
  totalPages: number;
};

export function MarketplaceStoreListView({
  initialStores,
}: {
  initialStores?: StoreResponse | null;
}) {
  const { t, currentLang } = useTranslate('marketplace');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const {
    data,
    isPending: loading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['public-stores', debouncedSearch, page],
    initialData: page === 1 && !debouncedSearch ? (initialStores ?? undefined) : undefined,
    initialDataUpdatedAt: initialStores?.updatedAt
      ? Date.parse(initialStores.updatedAt)
      : undefined,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<StoreResponse> => {
      const params = new URLSearchParams({ page: String(page), limit: '24' });
      if (debouncedSearch) params.set('q', debouncedSearch);
      const response = await fetch(`/api/marketplace/stores?${params}`, { signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'Unable to load stores');
      return result;
    },
    staleTime: 60_000,
    enabled: search.trim() === debouncedSearch,
  });
  const stores = data?.stores ?? [];
  const totalPages = data?.totalPages ?? 0;

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={{ xs: 3, md: 4 }}>
        <Box
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 3,
            bgcolor: 'primary.lighter',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 3,
          }}
        >
          <Box sx={{ maxWidth: 680 }}>
            <Typography
              component="h1"
              variant="h2"
              sx={{ typography: { xs: 'h3', md: 'h2' }, color: 'grey.900' }}
            >
              {t('stores.heading')}
            </Typography>
            <Typography sx={{ mt: 1.5, color: 'grey.700' }}>{t('stores.description')}</Typography>
          </Box>
          <Box
            sx={{
              display: { xs: 'none', md: 'grid' },
              width: 104,
              height: 104,
              flexShrink: 0,
              borderRadius: 3,
              placeItems: 'center',
              bgcolor: 'background.paper',
              color: 'primary.main',
            }}
          >
            <RiStore2Line size={48} aria-hidden />
          </Box>
        </Box>

        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
          >
            <Box aria-live="polite">
              <Typography component="h2" variant="h6">
                {t(debouncedSearch ? 'stores.searchResults' : 'stores.allStores')}
              </Typography>
              {!loading && !isError && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('stores.resultCount', {
                    count: data?.total ?? 0,
                    formattedCount: (data?.total ?? 0).toLocaleString(
                      currentLang.numberFormat.code
                    ),
                  })}
                </Typography>
              )}
            </Box>
            <TextField
              value={search}
              onChange={(event) => handleSearch(event.target.value)}
              placeholder={t('stores.searchPlaceholder')}
              size="small"
              sx={{ width: { xs: 1, sm: 380 }, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              slotProps={{
                htmlInput: { 'aria-label': t('stores.searchPlaceholder') },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <RiSearchLine size={20} />
                    </InputAdornment>
                  ),
                  endAdornment: search ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        aria-label={t('stores.clearSearch')}
                        onClick={() => handleSearch('')}
                      >
                        <RiCloseLine size={18} />
                      </IconButton>
                    </InputAdornment>
                  ) : undefined,
                },
              }}
            />
          </Stack>

          {isFetching && !loading && <LinearProgress aria-label={t('stores.heading')} />}
          {isError && (
            <Alert
              severity="error"
              action={
                <Button
                  color="inherit"
                  onClick={() => {
                    void refetch();
                  }}
                >
                  {t('errors.retry')}
                </Button>
              }
            >
              {t('stores.errors.load')}
            </Alert>
          )}
          <Grid container spacing={{ xs: 2, md: 2.5 }} aria-busy={loading}>
            {loading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <Grid key={index} size={{ xs: 12, sm: 6, md: 4 }}>
                    <StoreCardSkeleton />
                  </Grid>
                ))
              : stores.map((store) => (
                  <Grid key={store.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <StoreCard store={store} />
                  </Grid>
                ))}
          </Grid>

          {!loading && !isError && stores.length === 0 && (
            <Card
              variant="outlined"
              sx={{ py: 8, px: 3, textAlign: 'center', borderStyle: 'dashed' }}
            >
              <RiStore2Line size={52} color="#919EAB" aria-hidden />
              <Typography variant="h5" sx={{ mt: 2 }}>
                {t('stores.empty.title')}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {t('stores.empty.description')}
              </Typography>
              {!!search && (
                <Button variant="outlined" onClick={() => handleSearch('')} sx={{ mt: 2.5 }}>
                  {t('stores.clearSearch')}
                </Button>
              )}
            </Card>
          )}
        </Stack>

        {!loading && !isError && totalPages > 1 && (
          <Pagination
            page={page}
            count={totalPages}
            color="primary"
            shape="rounded"
            sx={{ alignSelf: 'center', '& .MuiPagination-ul': { justifyContent: 'center' } }}
            getItemAriaLabel={(type, itemPage) =>
              type === 'page'
                ? t('stores.pagination.page', { page: itemPage })
                : t(`stores.pagination.${type}`)
            }
            onChange={(_, nextPage) => {
              setPage(nextPage);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </Stack>
    </Container>
  );
}

function StoreCard({ store }: { store: PublicStore }) {
  const { t, currentLang } = useTranslate('marketplace');
  const storeIdentifier = store.slug || store.id;
  const storeName =
    currentLang.value === 'en' && store.display_name_en?.trim()
      ? store.display_name_en
      : store.display_name;

  return (
    <Card
      variant="outlined"
      sx={{
        height: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 3,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: 'none',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: 'primary.light',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
        },
      }}
    >
      <Box
        sx={{
          top: 14,
          right: 14,
          zIndex: 2,
          maxWidth: 'calc(100% - 28px)',
          position: 'absolute',
          '& .MuiStack-root': { justifyContent: 'flex-end' },
          '& .MuiChip-root': { backdropFilter: 'blur(6px)' },
        }}
      >
        <MarketplaceSellerBadges badges={store.badges} limit={3} variant="seal" />
      </Box>

      <Box
        component={RouterLink}
        href={paths.marketplace.store(storeIdentifier)}
        aria-label={storeName}
        sx={{
          height: 112,
          display: 'block',
          position: 'relative',
          textDecoration: 'none',
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: -2,
          },
          bgcolor: 'primary.lighter',
          backgroundImage: 'linear-gradient(135deg, #E9F2FF 0%, #DDF7F1 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {store.cover_url && (
          <Box
            component="img"
            src={store.cover_url}
            alt=""
            loading="lazy"
            decoding="async"
            sx={{ width: 1, height: 1, objectFit: 'cover', display: 'block' }}
          />
        )}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(15,23,42,0.04), rgba(15,23,42,0.34))',
          }}
        />
        <Avatar
          src={store.logo_url ?? undefined}
          alt={storeName}
          slotProps={{ img: { loading: 'lazy', decoding: 'async' } }}
          sx={{
            left: 20,
            bottom: -28,
            width: 68,
            height: 68,
            position: 'absolute',
            bgcolor: 'background.paper',
            '& img': { objectFit: 'contain' },
            color: 'primary.main',
            border: '4px solid',
            borderColor: 'background.paper',
          }}
        >
          <RiStore2Line size={31} />
        </Avatar>
      </Box>

      <Stack spacing={1.5} sx={{ px: 2.5, pt: 4.5, pb: 2.5, flex: 1, minWidth: 0 }}>
        <Box>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="flex-start"
            sx={{ '& > svg': { flexShrink: 0, mt: 0.5 } }}
          >
            <Typography
              component={RouterLink}
              href={paths.marketplace.store(storeIdentifier)}
              variant="h6"
              sx={{
                color: 'text.primary',
                textDecoration: 'none',
                minWidth: 0,
                overflowWrap: 'anywhere',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.4,
                '&:hover': { color: 'primary.main' },
              }}
            >
              {storeName}
            </Typography>
            {isSellerProfileVerified(store.profile_completion) && (
              <RiVerifiedBadgeFill
                size={20}
                color="#1565F5"
                aria-label={t('stores.card.verifiedProfile')}
              />
            )}
            {store.is_system_store && (
              <RiShieldStarFill
                size={20}
                color="#1565F5"
                aria-label={t('stores.card.systemStore')}
              />
            )}
          </Stack>
          <Chip
            size="small"
            variant="soft"
            label={t(`stores.sellerTypes.${store.seller_type}`, {
              defaultValue: t('stores.sellerTypes.seller'),
            })}
            sx={{ mt: 1 }}
          />
        </Box>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            minHeight: 42,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {store.bio || t('stores.card.defaultBio')}
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            bgcolor: 'background.neutral',
            borderRadius: 2,
            p: 1.5,
            gap: 1,
          }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
            <RiShoppingBag3Line size={18} aria-hidden />
            <Typography variant="caption" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
              {t('stores.card.products', {
                count: store.product_count,
                formattedCount: store.product_count.toLocaleString(currentLang.numberFormat.code),
              })}
            </Typography>
          </Stack>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ minWidth: 0, pl: 1.5, borderLeft: '1px solid', borderColor: 'divider' }}
          >
            <RiEyeLine size={18} aria-hidden />
            <Typography variant="caption" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
              {t('stores.card.visitors', {
                count: store.view_count,
                formattedCount: store.view_count.toLocaleString(currentLang.numberFormat.code),
              })}
            </Typography>
          </Stack>
        </Box>
        {store.review_count > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Rating
              value={store.average_rating}
              precision={0.1}
              readOnly
              size="small"
              sx={{ '& .MuiRating-icon': { fontSize: 17 } }}
            />
            <Typography variant="caption" color="text.secondary">
              ({store.review_count.toLocaleString(currentLang.numberFormat.code)})
            </Typography>
          </Stack>
        )}

        <Box sx={{ flexGrow: 1 }} />
        <Button
          fullWidth
          variant="outlined"
          component={RouterLink}
          href={paths.marketplace.store(storeIdentifier)}
          endIcon={<RiArrowRightLine />}
          sx={{ minHeight: 44, borderRadius: 2 }}
        >
          {t('stores.card.viewStore')}
        </Button>
      </Stack>
    </Card>
  );
}

function StoreCardSkeleton() {
  return (
    <Card
      variant="outlined"
      sx={{ height: 430, overflow: 'hidden', borderRadius: 3, position: 'relative' }}
    >
      <Skeleton variant="rectangular" height={112} />
      <Skeleton
        variant="circular"
        width={68}
        height={68}
        sx={{
          position: 'absolute',
          top: 72,
          left: 20,
          border: '4px solid',
          borderColor: 'background.paper',
        }}
      />
      <Stack spacing={1.5} sx={{ px: 2.5, pt: 4.5 }}>
        <Skeleton width="70%" height={28} />
        <Skeleton width="35%" height={24} />
        <Box>
          <Skeleton />
          <Skeleton width="80%" />
        </Box>
        <Skeleton variant="rounded" height={48} />
        <Skeleton variant="rounded" height={44} />
      </Stack>
    </Card>
  );
}
