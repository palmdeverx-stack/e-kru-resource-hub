'use client';

import type { MarketplaceProduct } from '../../shared/types';

import dynamic from 'next/dynamic';
import { useRef, useMemo, useState, useEffect } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { useTranslate } from 'src/locales';

import {
  RiApps2Line,
  RiSearchLine,
  RiBookOpenLine,
  RiEqualizer2Line,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { MARKETPLACE_CATEGORIES } from '../../shared/constants';
import { MarketplaceProductCard } from '../../shared/product-card';
import { getProducts, getCategories, getLocalizedProduct } from '../../shared/api';

const MarketplaceProductDetailDialog = dynamic(() =>
  import('../components/product-detail-dialog').then(
    (module) => module.MarketplaceProductDetailDialog
  )
);

const categoryTranslationKeys: Record<string, string> = {
  แผนการสอน: 'lessonPlans',
  ใบงาน: 'worksheets',
  สื่อประกอบ: 'supplementary',
  แบบทดสอบ: 'quizzes',
  คอร์สเรียน: 'courses',
  ซอฟต์แวร์และระบบการศึกษา: 'educationSoftware',
  'Prompt AI': 'aiPrompts',
  'AI Prompts': 'aiPrompts',
};

type PriceFilter = 'all' | 'free' | 'paid';

export function MarketplaceDashboardProductsView() {
  const { t, currentLang } = useTranslate('marketplace');
  const { user, loading: authLoading } = useAuthContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedCategory = searchParams.get('category') || 'all';
  const [category, setCategory] = useState(requestedCategory);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('popular');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCategory(requestedCategory);
  }, [requestedCategory]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const { data: categories = [...MARKETPLACE_CATEGORIES] } = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: async () => {
      const result = await getCategories();
      return result.categories.length
        ? ['all', ...result.categories.map((item) => item.name)]
        : [...MARKETPLACE_CATEGORIES];
    },
    staleTime: 5 * 60_000,
  });
  const {
    data,
    isPending: loading,
    isFetchingNextPage: loadingMore,
    hasNextPage: hasMore,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      'dashboard-products',
      user?.id ?? 'guest',
      user?.role ?? 'guest',
      debouncedSearch,
      category,
      priceFilter,
    ],
    enabled: !authLoading,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      getProducts(
        {
          q: debouncedSearch,
          category,
          price: priceFilter,
          page: pageParam,
          limit: 12,
          cards: true,
        },
        { signal }
      ),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextPage ?? undefined) : undefined,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const products = useMemo(() => {
    const unique = new Map<string, MarketplaceProduct>();
    data?.pages.forEach((entry) =>
      entry.products.forEach((product) => unique.set(product.id, product))
    );
    return [...unique.values()];
  }, [data]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || loading || loadingMore || error || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void fetchNextPage();
      },
      { rootMargin: '320px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, fetchNextPage, loading, loadingMore, error]);

  const displayedProducts = useMemo(() => {
    const filtered = products.filter(
      (product) =>
        (category === 'all' || product.category === category) &&
        (priceFilter === 'all' ||
          (priceFilter === 'free' ? Number(product.price) === 0 : Number(product.price) > 0)) &&
        (!search ||
          getLocalizedProduct(product, currentLang.value)
            .title.toLowerCase()
            .includes(search.toLowerCase()))
    );
    const sorted = [...filtered];

    if (sort === 'latest') {
      return sorted.sort(
        (first, second) =>
          new Date(second.created_at).getTime() - new Date(first.created_at).getTime()
      );
    }
    if (sort === 'rating') {
      return sorted.sort(
        (first, second) =>
          (second.engagement?.averageRating ?? 0) - (first.engagement?.averageRating ?? 0)
      );
    }
    if (sort === 'price-low') {
      return sorted.sort((first, second) => first.price - second.price);
    }

    return sorted.sort((first, second) => {
      const firstScore = (first.engagement?.purchases ?? 0) * 10 + (first.engagement?.views ?? 0);
      const secondScore =
        (second.engagement?.purchases ?? 0) * 10 + (second.engagement?.views ?? 0);
      return secondScore - firstScore;
    });
  }, [category, currentLang.value, priceFilter, products, search, sort]);

  const handleCategoryChange = (nextCategory: string) => {
    if (nextCategory === category) return;
    setCategory(nextCategory);
    router.replace(
      nextCategory === 'all'
        ? paths.marketplace.dashboardProducts
        : `${paths.marketplace.dashboardProducts}?category=${encodeURIComponent(nextCategory)}`,
      { scroll: false }
    );
  };

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Stack spacing={3.5}>
        {!!error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={() => void refetch()}>
                {t('dashboardUi.tryAgain')}
              </Button>
            }
          >
            {t('dashboardUi.unableToLoadResourcesPleaseTryAgain')}
          </Alert>
        )}
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
        >
          <Box>
            <Chip
              size="medium"
              icon={<RiBookOpenLine />}
              label={t('dashboardUi.catalog')}
              color="primary"
              variant="soft"
              sx={{ mb: 1.5 }}
            />
            <Typography variant="h3">{t('dashboardUi.allResources')}</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              {t('dashboardUi.findAndBuyTeachingResourcesWithYourE')}
            </Typography>
          </Box>

          <Chip
            icon={<RiApps2Line />}
            label={t('dashboardUi.resourceCount', {
              count: displayedProducts.length,
              formattedCount: displayedProducts.length.toLocaleString(
                currentLang.numberFormat.code
              ),
            })}
            variant="outlined"
          />
        </Stack>

        <Card variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <TextField
                fullWidth
                value={search}
                placeholder={t('dashboardUi.searchByTitleSubjectOrGradeLevel')}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <RiSearchLine size={20} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />

              <Select
                value={sort}
                aria-label={t('dashboardUi.sortResources')}
                onChange={(event) => setSort(String(event.target.value))}
                startAdornment={<RiEqualizer2Line size={19} />}
                sx={{
                  gap: 1,
                  minWidth: { xs: 1, md: 190 },
                  borderRadius: 2,
                  '& .MuiSelect-select': { pl: 1 },
                }}
              >
                <MenuItem value="popular">{t('dashboardUi.mostPopular')}</MenuItem>
                <MenuItem value="latest">{t('dashboardUi.newest')}</MenuItem>
                <MenuItem value="rating">{t('dashboardUi.topRated')}</MenuItem>
                <MenuItem value="price-low">{t('dashboardUi.lowestPrice')}</MenuItem>
              </Select>
            </Stack>

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              spacing={1.5}
            >
              <Box
                component="nav"
                aria-label={t('dashboardUi.resourceCategories')}
                sx={{
                  minWidth: 0,
                  flex: 1,
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  '&::-webkit-scrollbar': { display: 'none' },
                }}
              >
                <Stack direction="row" spacing={1} sx={{ width: 'max-content' }}>
                  {categories.map((item) => {
                    const active = item === category;
                    return (
                      <Button
                        key={item}
                        type="button"
                        size="small"
                        color={active ? 'primary' : 'inherit'}
                        variant={active ? 'contained' : 'outlined'}
                        onClick={() => handleCategoryChange(item)}
                        sx={{ px: 2, flexShrink: 0, borderRadius: 8 }}
                      >
                        {item === 'all'
                          ? t('dashboardUi.all')
                          : categoryTranslationKeys[item]
                            ? t(`categories.items.${categoryTranslationKeys[item]}`)
                            : item}
                      </Button>
                    );
                  })}
                </Stack>
              </Box>

              <Stack
                direction="row"
                spacing={0.25}
                role="group"
                aria-label={t('dashboardUi.filterByPrice')}
                sx={{
                  p: 0.5,
                  width: { xs: 1, md: 'auto' },
                  flexShrink: 0,
                  borderRadius: 999,
                  bgcolor: 'background.neutral',
                }}
              >
                {(
                  [
                    ['all', t('dashboardUi.allPrices')],
                    ['free', t('dashboardUi.free')],
                    ['paid', t('dashboardUi.paid')],
                  ] as const
                ).map(([value, label]) => {
                  const active = priceFilter === value;

                  return (
                    <Button
                      key={value}
                      size="small"
                      type="button"
                      variant={active ? 'contained' : 'text'}
                      color={active ? 'primary' : 'inherit'}
                      aria-pressed={active}
                      onClick={() => {
                        if (active) return;
                        setPriceFilter(value);
                      }}
                      sx={{
                        px: { xs: 0.75, sm: 1.5 },
                        py: 0.75,
                        minWidth: 0,
                        flex: { xs: 1, md: '0 0 auto' },
                        borderRadius: 999,
                        whiteSpace: 'nowrap',
                        color: active ? 'common.white' : 'text.secondary',
                        fontWeight: 700,
                        boxShadow: active ? '0 5px 14px rgba(21,101,245,0.24)' : 'none',
                        '&:hover': {
                          color: active ? 'common.white' : 'text.primary',
                          bgcolor: active ? 'primary.dark' : 'action.hover',
                        },
                      }}
                    >
                      {label}
                    </Button>
                  );
                })}
              </Stack>
            </Stack>
          </Stack>
        </Card>

        {loading && !products.length ? (
          <Box sx={{ py: 12, display: 'grid', placeItems: 'center' }}>
            <CircularProgress />
          </Box>
        ) : displayedProducts.length ? (
          <Box sx={{ minHeight: 360, position: 'relative' }}>
            {loading && (
              <Box
                sx={{
                  inset: 0,
                  zIndex: 2,
                  display: 'grid',
                  position: 'absolute',
                  placeItems: 'start center',
                  pointerEvents: 'none',
                }}
              >
                <CircularProgress size={28} sx={{ mt: 3 }} />
              </Box>
            )}

            <Grid
              container
              spacing={2.5}
              sx={{
                opacity: loading ? 0.45 : 1,
                pointerEvents: loading ? 'none' : 'auto',
                transition: 'opacity 160ms ease',
              }}
            >
              {displayedProducts.map((product, index) => (
                <Grid
                  key={product.id}
                  size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}
                  onClickCapture={(event) => {
                    if ((event.target as HTMLElement).closest('[data-marketplace-seller-link]')) {
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedProduct(product);
                  }}
                >
                  <MarketplaceProductCard product={product} colorIndex={index} />
                </Grid>
              ))}
            </Grid>

            <Box ref={loadMoreRef} sx={{ height: 1 }} />
            {loadingMore && (
              <Stack direction="row" spacing={1.25} justifyContent="center" sx={{ py: 4 }}>
                <CircularProgress size={22} />
                <Typography variant="body2" color="text.secondary">
                  {t('dashboardUi.loadingMoreResources')}
                </Typography>
              </Stack>
            )}
          </Box>
        ) : (
          <Card variant="outlined" sx={{ py: 10, px: 3, textAlign: 'center', borderRadius: 3 }}>
            <RiSearchLine size={42} />
            <Typography variant="h5" sx={{ mt: 1.5 }}>
              {t('dashboardUi.noMatchingResources')}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {t('dashboardUi.tryAnotherSearchOrChooseADifferentCategory')}
            </Typography>
          </Card>
        )}
      </Stack>

      {selectedProduct && (
        <MarketplaceProductDetailDialog
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </Container>
  );
}
