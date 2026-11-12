'use client';

import type { MarketplaceProduct } from '../../shared/types';

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { useTranslate } from 'src/locales';
import { apiFetch as fetch } from 'src/lib/api-fetch';

import {
  RiTimeLine,
  RiTodoLine,
  RiSearchLine,
  RiSchoolLine,
  RiStore2Line,
  RiGamepadLine,
  RiQuestionLine,
  RiBookOpenLine,
  RiBookReadLine,
  RiBearSmileLine,
  RiFileList3Line,
  RiArrowLeftSLine,
  RiArrowRightLine,
  RiShieldCheckLine,
  RiArrowRightSLine,
  RiPresentationLine,
  RiGraduationCapLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { getProducts, getCategories } from '../../shared/api';
import { MARKETPLACE_CATEGORIES } from '../../shared/constants';
import { MarketplaceProductCard } from '../../shared/product-card';
import { MarketplaceNewProductCard } from '../components/new-product-card';

type PublicStats = {
  teachers: number;
  schools: number;
  externalMembers: number;
};

type PriceFilter = 'all' | 'free' | 'paid';
type GradeGroup = 'all' | 'kindergarten' | 'primary' | 'secondary';

const normalizeGradeGroup = (value: string | null): GradeGroup => {
  if (value === 'kindergarten' || value === 'primary' || value === 'secondary') return value;
  return 'all';
};

const gradeCollections = [
  {
    gradeGroup: 'kindergarten',
    translationKey: 'kindergarten',
    icon: RiBearSmileLine,
    color: '#C2417A',
    background: 'linear-gradient(145deg, #FFF1F5 0%, #FDE7F0 100%)',
  },
  {
    gradeGroup: 'primary',
    translationKey: 'primary',
    icon: RiBookOpenLine,
    color: '#1565F5',
    background: 'linear-gradient(145deg, #EDF5FF 0%, #E2EEFF 100%)',
  },
  {
    gradeGroup: 'secondary',
    translationKey: 'secondary',
    icon: RiSchoolLine,
    color: '#087F5B',
    background: 'linear-gradient(145deg, #EAFBF3 0%, #DDF6EA 100%)',
  },
] as const;

const teachingGoals = [
  {
    translationKey: 'lessonPlans',
    category: 'แผนการสอน',
    icon: RiFileList3Line,
    color: '#1565F5',
    background: '#EAF2FF',
  },
  {
    translationKey: 'worksheets',
    category: 'ใบงาน',
    icon: RiTodoLine,
    color: '#16A36A',
    background: '#E9F8F0',
  },
  {
    translationKey: 'supplementary',
    category: 'สื่อประกอบ',
    icon: RiGamepadLine,
    color: '#8B5CF6',
    background: '#F2EDFF',
  },
  {
    translationKey: 'quizzes',
    category: 'แบบทดสอบ',
    icon: RiQuestionLine,
    color: '#F59E0B',
    background: '#FFF5D9',
  },
  {
    translationKey: 'courses',
    category: 'คอร์สเรียน',
    icon: RiPresentationLine,
    color: '#E64A78',
    background: '#FDECF2',
  },
  {
    translationKey: 'explore',
    category: 'all',
    icon: RiBookReadLine,
    color: '#0788A8',
    background: '#E7F7FA',
  },
] as const;

const categoryTranslationKeys: Record<string, string> = {
  แผนการสอน: 'lessonPlans',
  ใบงาน: 'worksheets',
  สื่อประกอบ: 'supplementary',
  แบบทดสอบ: 'quizzes',
  คอร์สเรียน: 'courses',
};

export function MarketplaceCatalogView() {
  const { t, currentLang } = useTranslate('marketplace');
  const formatCount = (value: number) =>
    new Intl.NumberFormat(currentLang.numberFormat.code).format(value);
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedCategory = searchParams.get('category') || 'all';
  const requestedGradeGroup = normalizeGradeGroup(searchParams.get('grade'));
  const requestedSearch = searchParams.get('q')?.trim() || '';
  const [search, setSearch] = useState(requestedSearch);
  const [category, setCategory] = useState(requestedCategory);
  const [gradeGroup, setGradeGroup] = useState<GradeGroup>(requestedGradeGroup);
  const [sort, setSort] = useState('popular');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const newProductsScrollRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const [debouncedSearch, setDebouncedSearch] = useState(requestedSearch);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Both the latest row and the catalog reuse the same page request/cache.
  const fetchProductPage = useCallback(
    (params: Parameters<typeof getProducts>[0]) => {
      const normalized = {
        q: params?.q || '',
        category: params?.category || 'all',
        price: params?.price ?? 'all',
        gradeGroup: params?.gradeGroup,
        excludeOfficial: params?.excludeOfficial ?? false,
        page: params?.page ?? 1,
        limit: 12,
      };
      return queryClient.fetchQuery({
        queryKey: ['catalog-page', user?.id ?? 'guest', user?.role ?? 'guest', normalized],
        queryFn: () => getProducts(normalized),
        staleTime: 60_000,
        retry: false,
      });
    },
    [queryClient, user?.id, user?.role]
  );
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
  const { data: publicStats, isPending: publicStatsLoading } = useQuery({
    queryKey: ['landing', 'stats'],
    queryFn: async (): Promise<PublicStats> => {
      const response = await fetch('/api/marketplace/public-stats');
      if (!response.ok) throw new Error('Failed to load public stats');
      return response.json();
    },
    staleTime: 5 * 60_000,
  });
  const { data: latestPage, isPending: newProductsLoading } = useQuery({
    queryKey: ['catalog-latest', user?.id ?? 'guest', user?.role ?? 'guest'],
    queryFn: () => fetchProductPage({ page: 1 }),
    staleTime: 60_000,
  });
  const newProducts = latestPage?.products ?? [];
  const {
    data: catalogPages,
    isPending: loading,
    isError: loadError,
    isFetchNextPageError: loadMoreError,
    refetch,
    isFetchingNextPage: loadingMore,
    hasNextPage: hasMore,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'catalog',
      'community-products',
      user?.id ?? 'guest',
      user?.role ?? 'guest',
      debouncedSearch,
      category,
      gradeGroup,
      priceFilter,
    ],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchProductPage({
        q: debouncedSearch,
        excludeOfficial: true,
        category,
        price: priceFilter,
        gradeGroup: gradeGroup === 'all' ? undefined : gradeGroup,
        page: pageParam,
      }),
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.hasMore ? lastPageParam + 1 : undefined,
    staleTime: 60_000,
  });
  const products = useMemo(() => {
    const unique = new Map<string, MarketplaceProduct>();
    catalogPages?.pages.forEach((page) =>
      page.products.forEach((product) => unique.set(product.id, product))
    );
    return [...unique.values()];
  }, [catalogPages]);
  const loadMoreProducts = useCallback(() => {
    if (!loading && !loadingMore && hasMore && search.trim() === debouncedSearch) {
      void fetchNextPage();
    }
  }, [loading, loadingMore, hasMore, search, debouncedSearch, fetchNextPage]);

  useEffect(() => {
    setCategory(requestedCategory);
  }, [requestedCategory]);

  useEffect(() => {
    setGradeGroup(requestedGradeGroup);
  }, [requestedGradeGroup]);

  useEffect(() => {
    setSearch(requestedSearch);
  }, [requestedSearch]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || loading || loadingMore || loadMoreError || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreProducts();
      },
      { rootMargin: '320px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMoreProducts, loading, loadingMore, loadMoreError]);

  const sortedDisplayedProducts = useMemo(() => {
    const sorted = [...products];

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
  }, [products, sort]);

  const updateCatalogUrl = (
    nextCategory: string,
    nextGradeGroup: GradeGroup,
    nextSearch = search
  ) => {
    const params = new URLSearchParams();
    if (nextCategory !== 'all') params.set('category', nextCategory);
    if (nextGradeGroup !== 'all') params.set('grade', nextGradeGroup);
    if (nextSearch.trim()) params.set('q', nextSearch.trim());
    const query = params.toString();

    router.replace(query ? `${paths.marketplace.products}?${query}` : paths.marketplace.products, {
      scroll: false,
    });
  };

  const handleCategoryChange = (nextCategory: string) => {
    if (nextCategory !== category) {
      setCategory(nextCategory);
    }
    updateCatalogUrl(nextCategory, gradeGroup);
  };

  const handleGradeGroupChange = (nextGradeGroup: GradeGroup) => {
    if (nextGradeGroup !== gradeGroup) {
      setGradeGroup(nextGradeGroup);
    }
    updateCatalogUrl(category, nextGradeGroup);
  };

  const handleGradeCollectionSelect = (nextGradeGroup: Exclude<GradeGroup, 'all'>) => {
    setSearch('');
    setCategory('all');
    setPriceFilter('all');
    setGradeGroup(nextGradeGroup);
    updateCatalogUrl('all', nextGradeGroup, '');
  };

  const scrollNewProducts = (direction: -1 | 1) => {
    const container = newProductsScrollRef.current;
    const firstCard = container?.firstElementChild as HTMLElement | null;
    if (!container || !firstCard) return;

    const gap = Number.parseFloat(window.getComputedStyle(container).columnGap) || 0;
    const cardStep = firstCard.getBoundingClientRect().width + gap;
    const visibleCards = Math.max(1, Math.round((container.clientWidth + gap) / cardStep));
    const currentIndex = Math.round(container.scrollLeft / cardStep);
    const nextIndex = Math.max(0, currentIndex + direction * visibleCards);

    container.scrollTo({
      left: nextIndex * cardStep,
      behavior: 'smooth',
    });
  };

  return (
    <>
      <Box
        sx={(theme) => ({
          py: { xs: 7, md: 11 },
        })}
      >
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={3} alignItems={{ xs: 'center', md: 'flex-start' }}>
                <Chip icon={<RiGraduationCapLine />} label={t('catalog.hero.eyebrow')} />
                <Typography
                  component="h1"
                  variant="h1"
                  sx={{ fontSize: { xs: 42, md: 68 }, textAlign: { xs: 'center', md: 'left' } }}
                >
                  {t('catalog.hero.title')}
                  <Box component="span" sx={{ color: 'primary.main' }}>
                    {' '}
                    {t('catalog.hero.highlight')}
                  </Box>
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    maxWidth: 660,
                    color: 'text.secondary',
                    fontWeight: 400,
                    textAlign: { xs: 'center', md: 'left' },
                  }}
                >
                  {t('catalog.hero.description')}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    size="large"
                    variant="contained"
                    href="#products"
                    startIcon={<RiBookOpenLine />}
                  >
                    {t('catalog.actions.browse')}
                  </Button>
                  <Button
                    size="large"
                    variant="outlined"
                    component={RouterLink}
                    href={paths.marketplace.seller}
                    startIcon={<RiStore2Line />}
                  >
                    {t('catalog.actions.openStore')}
                  </Button>
                </Stack>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Box
                sx={{
                  p: 4,
                  borderRadius: 5,
                  color: 'common.white',
                  bgcolor: 'primary.darker',
                  boxShadow: '0 32px 80px rgba(13, 63, 156, 0.24)',
                }}
              >
                <Stack spacing={3}>
                  <RiShieldCheckLine size={48} />
                  <Typography variant="h3">{t('catalog.account.title')}</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.76)' }}>
                    {t('catalog.account.description')}
                  </Typography>
                  <Stack direction="row" spacing={4}>
                    <Box>
                      {publicStatsLoading ? (
                        <Skeleton
                          width={72}
                          height={42}
                          sx={{ bgcolor: 'rgba(255,255,255,0.18)' }}
                        />
                      ) : (
                        <Typography variant="h3">
                          {publicStats
                            ? formatCount(publicStats.teachers + publicStats.externalMembers)
                            : '—'}
                        </Typography>
                      )}
                      <Typography variant="caption">{t('catalog.account.members')}</Typography>
                    </Box>
                    <Box>
                      {publicStatsLoading ? (
                        <Skeleton
                          width={72}
                          height={42}
                          sx={{ bgcolor: 'rgba(255,255,255,0.18)' }}
                        />
                      ) : (
                        <Typography variant="h3">
                          {publicStats ? formatCount(publicStats.schools) : '—'}
                        </Typography>
                      )}
                      <Typography variant="caption">{t('catalog.account.schools')}</Typography>
                    </Box>
                  </Stack>
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box
        component="section"
        aria-labelledby="teaching-goals-title"
        sx={{ py: { xs: 7, md: 9 }, bgcolor: 'background.neutral' }}
      >
        <Container maxWidth="lg">
          <Stack spacing={{ xs: 3, md: 4 }}>
            <Box sx={{ maxWidth: 680 }}>
              <Typography id="teaching-goals-title" variant="h3">
                {t('catalog.goals.heading')}
              </Typography>
              <Typography sx={{ mt: 1, color: 'text.secondary' }}>
                {t('catalog.goals.description')}
              </Typography>
            </Box>

            <Grid container spacing={2}>
              {teachingGoals.map((goal) => {
                const Icon = goal.icon;
                const active = category === goal.category;

                return (
                  <Grid key={goal.translationKey} size={{ xs: 12, sm: 6, md: 4 }}>
                    <ButtonBase
                      aria-pressed={active}
                      onClick={() => {
                        handleCategoryChange(goal.category);
                        window.requestAnimationFrame(() => {
                          document.getElementById('products')?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                        });
                      }}
                      sx={{
                        p: 2.5,
                        gap: 2,
                        width: 1,
                        height: 1,
                        minHeight: 120,
                        display: 'flex',
                        borderRadius: 3,
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        alignItems: 'flex-start',
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: active ? 'primary.main' : 'divider',
                        boxShadow: active
                          ? '0 12px 32px rgba(21,101,245,0.14)'
                          : '0 6px 18px rgba(15,23,42,0.04)',
                        transition:
                          'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
                        '&:hover': {
                          transform: 'translateY(-3px)',
                          borderColor: active ? 'primary.main' : 'text.disabled',
                          boxShadow: '0 14px 32px rgba(15,23,42,0.10)',
                        },
                        '&:focus-visible': {
                          outline: '3px solid',
                          outlineColor: 'primary.lighter',
                          outlineOffset: 2,
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          display: 'grid',
                          flexShrink: 0,
                          borderRadius: 2,
                          color: goal.color,
                          placeItems: 'center',
                          bgcolor: goal.background,
                        }}
                      >
                        <Icon size={25} />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ lineHeight: 1.35 }}>
                          {t(`catalog.goals.items.${goal.translationKey}.title`)}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ mt: 0.75, color: 'text.secondary', lineHeight: 1.6 }}
                        >
                          {t(`catalog.goals.items.${goal.translationKey}.description`)}
                        </Typography>
                      </Box>
                    </ButtonBase>
                  </Grid>
                );
              })}
            </Grid>
          </Stack>
        </Container>
      </Box>

      <Container id="products" maxWidth="lg" sx={{ py: { xs: 7 } }}>
        <Stack spacing={4}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={1.5}
          >
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h3">{t('catalog.products.heading')}</Typography>
              <Typography sx={{ mt: 1, color: 'text.secondary' }}>
                {t('catalog.products.description')}
              </Typography>
            </Box>
            {gradeGroup !== 'all' && (
              <Chip
                color="primary"
                variant="soft"
                label={t('catalog.filters.activeGrade', {
                  grade: t(
                    `catalog.grades.${
                      gradeCollections.find((item) => item.gradeGroup === gradeGroup)
                        ?.translationKey
                    }.label`
                  ),
                })}
                onDelete={() => handleGradeGroupChange('all')}
              />
            )}
          </Stack>

          <Stack
            spacing={1.5}
            sx={{
              p: { xs: 1.5, md: 2 },
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2.5,
              bgcolor: 'background.paper',
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 180px' },
                gap: 1.25,
                alignItems: 'end',
              }}
            >
              <TextField
                fullWidth
                size="small"
                value={search}
                placeholder={t('catalog.filters.searchPlaceholder')}
                onChange={(event) => setSearch(event.target.value)}
                slotProps={{
                  htmlInput: { 'aria-label': t('catalog.filters.searchPlaceholder') },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <RiSearchLine size={20} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ '& .MuiOutlinedInput-root': { minHeight: 42, borderRadius: 1.5 } }}
              />
              <Box>
                <Select
                  fullWidth
                  size="small"
                  value={sort}
                  inputProps={{ 'aria-label': t('catalog.filters.sortAria') }}
                  onChange={(event) => setSort(String(event.target.value))}
                  sx={{ height: 42, borderRadius: 1.5 }}
                >
                  <MenuItem value="popular">{t('catalog.filters.sort.popular')}</MenuItem>
                  <MenuItem value="latest">{t('catalog.filters.sort.latest')}</MenuItem>
                  <MenuItem value="rating">{t('catalog.filters.sort.rating')}</MenuItem>
                  <MenuItem value="price-low">{t('catalog.filters.sort.priceLow')}</MenuItem>
                </Select>
              </Box>
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: { xs: 1.5, md: 3 },
              }}
            >
              <Box
                role="group"
                aria-label={t('catalog.filters.gradeAria')}
                sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {t('catalog.filters.gradeLabel')}
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {(
                    [
                      ['all', 'all'],
                      ['kindergarten', 'kindergarten'],
                      ['primary', 'primary'],
                      ['secondary', 'secondary'],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      size="small"
                      type="button"
                      aria-pressed={gradeGroup === value}
                      variant={gradeGroup === value ? 'contained' : 'outlined'}
                      color={gradeGroup === value ? 'primary' : 'inherit'}
                      onClick={() => handleGradeGroupChange(value)}
                      sx={{
                        minHeight: { xs: 40, md: 34 },
                        px: 1.25,
                        borderRadius: 1.5,
                        boxShadow: 'none',
                        borderColor: gradeGroup === value ? 'primary.main' : 'divider',
                        '&:hover': { boxShadow: 'none' },
                      }}
                    >
                      {t(`catalog.filters.grades.${label}`)}
                    </Button>
                  ))}
                </Stack>
              </Box>
              <Box
                role="group"
                aria-label={t('catalog.filters.priceAria')}
                sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {t('catalog.filters.priceAria')}
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {(
                    [
                      ['all', 'all'],
                      ['free', 'free'],
                      ['paid', 'paid'],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      size="small"
                      type="button"
                      aria-pressed={priceFilter === value}
                      variant={priceFilter === value ? 'contained' : 'outlined'}
                      color={priceFilter === value ? 'primary' : 'inherit'}
                      onClick={() => setPriceFilter(value)}
                      sx={{
                        minHeight: { xs: 40, md: 34 },
                        px: 1.25,
                        borderRadius: 1.5,
                        boxShadow: 'none',
                        borderColor: priceFilter === value ? 'primary.main' : 'divider',
                        '&:hover': { boxShadow: 'none' },
                      }}
                    >
                      {t(`catalog.filters.prices.${label}`)}
                    </Button>
                  ))}
                </Stack>
              </Box>
            </Box>
            <Box
              role="group"
              aria-label={t('catalog.filters.categoryAria')}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                flexWrap: { xs: 'wrap', md: 'nowrap' },
                gap: 1,
                pt: 1.25,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {categories.map((item) => {
                  const active = category === item;
                  return (
                    <Button
                      key={item}
                      type="button"
                      size="small"
                      aria-pressed={active}
                      variant="outlined"
                      color={active ? 'primary' : 'inherit'}
                      onClick={() => handleCategoryChange(item)}
                      sx={{
                        minHeight: { xs: 40, md: 34 },
                        px: 1.75,
                        borderRadius: 999,
                        bgcolor: active ? 'primary.lighter' : 'background.paper',
                        borderColor: active ? 'primary.light' : 'divider',
                        color: active ? 'primary.dark' : 'text.secondary',
                        maxWidth: '100%',
                        textAlign: 'left',
                        '&:hover': {
                          bgcolor: 'primary.lighter',
                          borderColor: 'primary.main',
                        },
                      }}
                    >
                      {item === 'all'
                        ? t('catalog.filters.allCategories')
                        : categoryTranslationKeys[item]
                          ? t(`catalog.categoryLabels.${categoryTranslationKeys[item]}`)
                          : item}
                    </Button>
                  );
                })}
              </Stack>
            </Box>
          </Stack>

          {loadError && (
            <Alert
              severity="error"
              action={
                <Button
                  color="inherit"
                  onClick={() => {
                    void (loadMoreError ? fetchNextPage() : refetch());
                  }}
                >
                  {t('errors.retry')}
                </Button>
              }
            >
              {t('errors.products')}
            </Alert>
          )}
          {loading && !products.length ? (
            <Box sx={{ py: 10, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : sortedDisplayedProducts.length ? (
            <Box sx={{ position: 'relative', minHeight: 360 }}>
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
                  <CircularProgress size={28} sx={{ mt: 2 }} />
                </Box>
              )}
              <Grid
                container
                spacing={3}
                sx={{
                  opacity: loading ? 0.45 : 1,
                  pointerEvents: loading ? 'none' : 'auto',
                  transition: 'opacity 160ms ease',
                }}
              >
                {sortedDisplayedProducts.map((product, index) => (
                  <Grid key={product.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <MarketplaceProductCard product={product} colorIndex={index} />
                  </Grid>
                ))}
              </Grid>
              <Box ref={loadMoreRef} sx={{ height: 1 }} />
              {loadingMore && (
                <Stack direction="row" spacing={1.25} justifyContent="center" sx={{ py: 4 }}>
                  <CircularProgress size={22} />
                  <Typography variant="body2" color="text.secondary">
                    {t('catalog.states.loadingMore')}
                  </Typography>
                </Stack>
              )}
            </Box>
          ) : (
            <Box sx={{ py: 10, textAlign: 'center' }}>
              <Typography variant="h5">
                {gradeGroup === 'all'
                  ? t('catalog.states.noResults')
                  : t('catalog.states.noGradeResults', {
                      grade: t(
                        `catalog.grades.${
                          gradeCollections.find((item) => item.gradeGroup === gradeGroup)
                            ?.translationKey
                        }.label`
                      ),
                    })}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                {gradeGroup === 'all'
                  ? t('catalog.states.noResultsHint')
                  : t('catalog.states.noGradeResultsHint')}
              </Typography>
              {gradeGroup !== 'all' && (
                <Button sx={{ mt: 2 }} onClick={() => handleGradeGroupChange('all')}>
                  {t('catalog.actions.allGrades')}
                </Button>
              )}
            </Box>
          )}
        </Stack>
        <Divider sx={{ my: { xs: 5, md: 8 } }} />
        <Box
          component="section"
          aria-labelledby="new-products-title"
          sx={{
            p: { xs: 2, sm: 3, md: 4 },
            position: 'relative',
            overflow: 'hidden',
            borderRadius: { xs: 3, md: 4 },
            border: '1px solid',
            borderColor: 'primary.lighter',
            background:
              'linear-gradient(145deg, rgba(231,240,255,0.88) 0%, rgba(255,255,255,0.98) 52%, rgba(232,250,245,0.82) 100%)',
            '&::before': {
              top: -120,
              right: -80,
              width: 280,
              height: 280,
              content: '""',
              opacity: 0.55,
              position: 'absolute',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(21,101,245,0.18), transparent 68%)',
              pointerEvents: 'none',
            },
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={2}
            sx={{ mb: { xs: 2.5, md: 3.5 }, position: 'relative' }}
          >
            <Stack direction="row" spacing={1.75} alignItems="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  display: 'grid',
                  flexShrink: 0,
                  borderRadius: 2,
                  color: 'primary.main',
                  placeItems: 'center',
                  bgcolor: 'common.white',
                  boxShadow: '0 10px 28px rgba(21,101,245,0.13)',
                }}
              >
                <RiTimeLine size={25} />
              </Box>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography id="new-products-title" variant="h3">
                    {t('catalog.newProducts.heading')}
                  </Typography>
                </Stack>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('catalog.newProducts.description')}
                </Typography>
              </Box>
            </Stack>

            {newProducts.length > 1 && (
              <Stack direction="row" spacing={1}>
                <IconButton
                  aria-label={t('catalog.newProducts.previous')}
                  onClick={() => scrollNewProducts(-1)}
                  sx={{
                    bgcolor: 'common.white',
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: '0 6px 18px rgba(15,23,42,0.08)',
                  }}
                >
                  <RiArrowLeftSLine />
                </IconButton>
                <IconButton
                  aria-label={t('catalog.newProducts.next')}
                  onClick={() => scrollNewProducts(1)}
                  sx={{
                    color: 'common.white',
                    bgcolor: 'primary.main',
                    border: '1px solid',
                    borderColor: 'primary.main',
                    boxShadow: '0 8px 20px rgba(21,101,245,0.22)',
                    '&:hover': { bgcolor: 'primary.dark' },
                  }}
                >
                  <RiArrowRightSLine />
                </IconButton>
              </Stack>
            )}
          </Stack>

          {newProductsLoading ? (
            <Box sx={{ minHeight: 280, display: 'grid', placeItems: 'center' }}>
              <CircularProgress />
            </Box>
          ) : newProducts.length ? (
            <Box
              ref={newProductsScrollRef}
              sx={{
                pt: 2,
                pb: 5.5,
                gap: 2,
                display: 'grid',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                gridAutoFlow: 'column',
                gridAutoColumns: {
                  xs: '100%',
                  sm: 'calc((100% - 16px) / 2)',
                  md: 'calc((100% - 32px) / 3)',
                },
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              {newProducts.map((newProduct, index) => (
                <Box
                  key={newProduct.id}
                  sx={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
                >
                  <MarketplaceNewProductCard product={newProduct} colorIndex={index} />
                </Box>
              ))}
            </Box>
          ) : (
            <Box
              sx={{
                py: 7,
                display: 'grid',
                textAlign: 'center',
                placeItems: 'center',
                position: 'relative',
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  display: 'grid',
                  borderRadius: '50%',
                  color: 'text.secondary',
                  placeItems: 'center',
                  bgcolor: 'common.white',
                }}
              >
                <RiBookOpenLine size={30} />
              </Box>
              <Typography variant="h6" sx={{ mt: 2 }}>
                {t('catalog.newProducts.emptyTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t('catalog.newProducts.emptyDescription')}
              </Typography>
            </Box>
          )}
        </Box>
      </Container>

      <Box component="section" aria-labelledby="grade-collections-title" sx={{ py: { xs: 5 } }}>
        <Container maxWidth="lg">
          <Stack spacing={{ xs: 3, md: 4 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
              spacing={2}
            >
              <Box sx={{ maxWidth: 680 }}>
                <Typography id="grade-collections-title" variant="h3">
                  {t('catalog.gradeCollections.heading')}
                </Typography>
                <Typography sx={{ mt: 1, color: 'text.secondary' }}>
                  {t('catalog.gradeCollections.description')}
                </Typography>
              </Box>
              {gradeGroup !== 'all' && (
                <Button
                  color="inherit"
                  endIcon={<RiArrowRightLine />}
                  onClick={() => handleGradeGroupChange('all')}
                >
                  {t('catalog.actions.allGrades')}
                </Button>
              )}
            </Stack>

            <Grid container spacing={2.5}>
              {gradeCollections.map((collection) => {
                const Icon = collection.icon;
                const active = gradeGroup === collection.gradeGroup;

                return (
                  <Grid key={collection.gradeGroup} size={{ xs: 12, md: 4 }}>
                    <ButtonBase
                      aria-pressed={active}
                      onClick={() => {
                        handleGradeCollectionSelect(collection.gradeGroup);
                        window.requestAnimationFrame(() => {
                          document.getElementById('products')?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                        });
                      }}
                      sx={{
                        p: { xs: 3, md: 3.5 },
                        width: 1,
                        height: 1,
                        minHeight: 250,
                        display: 'flex',
                        overflow: 'hidden',
                        position: 'relative',
                        borderRadius: 4,
                        textAlign: 'left',
                        alignItems: 'stretch',
                        flexDirection: 'column',
                        background: collection.background,
                        border: '2px solid',
                        borderColor: active ? collection.color : 'transparent',
                        boxShadow: active
                          ? `0 18px 40px ${collection.color}24`
                          : '0 10px 30px rgba(15,23,42,0.06)',
                        transition:
                          'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
                        '&::after': {
                          right: -32,
                          bottom: -50,
                          width: 160,
                          height: 160,
                          content: '""',
                          opacity: 0.1,
                          position: 'absolute',
                          borderRadius: '50%',
                          bgcolor: collection.color,
                        },
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: `0 20px 44px ${collection.color}22`,
                        },
                        '&:focus-visible': {
                          outline: '3px solid',
                          outlineColor: collection.color,
                          outlineOffset: 3,
                        },
                      }}
                    >
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ position: 'relative', zIndex: 1 }}
                      >
                        <Box
                          sx={{
                            width: 54,
                            height: 54,
                            display: 'grid',
                            borderRadius: 2.5,
                            color: collection.color,
                            placeItems: 'center',
                            bgcolor: 'rgba(255,255,255,0.78)',
                          }}
                        >
                          <Icon size={29} />
                        </Box>
                        <Chip
                          size="small"
                          label={t(`catalog.grades.${collection.translationKey}.levels`)}
                          sx={{
                            color: collection.color,
                            fontWeight: 700,
                            bgcolor: 'rgba(255,255,255,0.72)',
                          }}
                        />
                      </Stack>

                      <Box sx={{ mt: 3, position: 'relative', zIndex: 1 }}>
                        <Typography variant="overline" sx={{ color: collection.color }}>
                          {t(`catalog.grades.${collection.translationKey}.label`)}
                        </Typography>
                        <Typography variant="h5" sx={{ mt: 0.5 }}>
                          {t(`catalog.grades.${collection.translationKey}.title`)}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ mt: 1.25, maxWidth: 330, color: 'text.secondary', lineHeight: 1.7 }}
                        >
                          {t(`catalog.grades.${collection.translationKey}.description`)}
                        </Typography>
                      </Box>

                      <Stack
                        direction="row"
                        spacing={0.75}
                        alignItems="center"
                        sx={{
                          mt: 'auto',
                          pt: 2.5,
                          color: collection.color,
                          position: 'relative',
                          zIndex: 1,
                        }}
                      >
                        <Typography variant="subtitle2">{t('catalog.actions.browse')}</Typography>
                        <RiArrowRightLine size={18} />
                      </Stack>
                    </ButtonBase>
                  </Grid>
                );
              })}
            </Grid>
          </Stack>
        </Container>
      </Box>
    </>
  );
}
