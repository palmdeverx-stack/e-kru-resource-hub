'use client';

import type { MarketplaceSeller } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Rating from '@mui/material/Rating';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Pagination from '@mui/material/Pagination';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import {
  RiSearchLine,
  RiStore2Line,
  RiArrowRightLine,
  RiShieldStarFill,
  RiShoppingBag3Line,
  RiVerifiedBadgeFill,
} from 'src/components/remix-icon';

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
> & {
  product_count: number;
  review_count: number;
  average_rating: number;
};

type StoreResponse = {
  stores: PublicStore[];
  total: number;
  page: number;
  totalPages: number;
};

export function MarketplaceStoreListView() {
  const { t, currentLang } = useTranslate('marketplace');
  const [stores, setStores] = useState<PublicStore[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '24',
      });
      if (search.trim()) params.set('q', search.trim());

      fetch(`/api/marketplace/stores?${params}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
        .then(async (response) => {
          const result = (await response.json()) as StoreResponse & { message?: string };
          if (!response.ok) throw new Error(result.message ?? t('stores.errors.load'));
          return result;
        })
        .then((result) => {
          setStores(result.stores);
          setTotal(result.total);
          setTotalPages(result.totalPages);
        })
        .catch((error) => {
          if (error instanceof Error && error.name === 'AbortError') return;
          setStores([]);
          setTotal(0);
          setTotalPages(0);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [page, search, t]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
      <Stack spacing={4}>
        <Box>
          <Typography component="h1" variant="h2">
            {t('stores.heading')}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 720 }}>
            {t('stores.description')}
          </Typography>
        </Box>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
        >
          <TextField
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
            placeholder={t('stores.searchPlaceholder')}
            sx={{ width: { xs: 1, sm: 420 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <RiSearchLine size={20} />
                  </InputAdornment>
                ),
              },
            }}
          />
          {!loading && (
            <Typography variant="body2" color="text.secondary">
              {t('stores.approvedCount', {
                count: total,
                formattedCount: total.toLocaleString(currentLang.numberFormat.code),
              })}
            </Typography>
          )}
        </Stack>

        <Grid container spacing={2.5}>
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

        {!loading && stores.length === 0 && (
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
          </Card>
        )}

        {totalPages > 1 && (
          <Pagination
            page={page}
            count={totalPages}
            color="primary"
            getItemAriaLabel={(type, itemPage) =>
              type === 'page'
                ? t('stores.pagination.page', { page: itemPage })
                : t(`stores.pagination.${type}`)
            }
            onChange={(_, nextPage) => {
              setPage(nextPage);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            sx={{ alignSelf: 'center' }}
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
        overflow: 'hidden',
        borderRadius: 3,
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          borderColor: 'primary.light',
          boxShadow: '0 14px 36px rgba(15, 23, 42, 0.10)',
        },
      }}
    >
      <Box
        component={RouterLink}
        href={paths.marketplace.store(storeIdentifier)}
        sx={{
          height: 116,
          display: 'block',
          position: 'relative',
          textDecoration: 'none',
          bgcolor: 'primary.lighter',
          backgroundImage: store.cover_url
            ? `linear-gradient(180deg, rgba(15,23,42,0.04), rgba(15,23,42,0.34)), url(${store.cover_url})`
            : 'linear-gradient(135deg, #E9F2FF 0%, #DDF7F1 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <Avatar
          src={store.logo_url ?? undefined}
          alt={storeName}
          sx={{
            left: 22,
            bottom: -34,
            width: 72,
            height: 72,
            position: 'absolute',
            bgcolor: 'common.white',
            color: 'primary.main',
            border: '4px solid',
            borderColor: 'background.paper',
          }}
        >
          <RiStore2Line size={31} />
        </Avatar>
      </Box>

      <Stack spacing={2} sx={{ px: 2.5, pt: 5.5, pb: 2.5 }}>
        <Box>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography
              component={RouterLink}
              href={paths.marketplace.store(storeIdentifier)}
              variant="h6"
              noWrap
              sx={{ color: 'text.primary', textDecoration: 'none' }}
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

        <Stack direction="row" spacing={2.5} alignItems="center">
          <Stack direction="row" spacing={0.75} alignItems="center">
            <RiShoppingBag3Line size={18} />
            <Typography variant="body2">
              {t('stores.card.products', {
                count: store.product_count,
                formattedCount: store.product_count.toLocaleString(currentLang.numberFormat.code),
              })}
            </Typography>
          </Stack>
          {store.review_count > 0 && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Rating value={store.average_rating} precision={0.1} readOnly size="small" />
              <Typography variant="caption" color="text.secondary">
                ({store.review_count.toLocaleString(currentLang.numberFormat.code)})
              </Typography>
            </Stack>
          )}
        </Stack>

        <Button
          fullWidth
          variant="outlined"
          component={RouterLink}
          href={paths.marketplace.store(storeIdentifier)}
          endIcon={<RiArrowRightLine />}
        >
          {t('stores.card.viewStore')}
        </Button>
      </Stack>
    </Card>
  );
}

function StoreCardSkeleton() {
  return (
    <Card variant="outlined" sx={{ height: 390, overflow: 'hidden', borderRadius: 3 }}>
      <Skeleton variant="rectangular" height={116} />
      <Stack spacing={1.5} sx={{ px: 2.5, pt: 5.5 }}>
        <Skeleton width="62%" height={30} />
        <Skeleton width="30%" height={24} />
        <Skeleton />
        <Skeleton width="82%" />
        <Skeleton variant="rounded" height={40} sx={{ mt: 2 }} />
      </Stack>
    </Card>
  );
}
