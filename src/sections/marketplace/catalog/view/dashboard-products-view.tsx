'use client';

import type { MarketplaceProduct } from '../../shared/types';

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
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

import { MarketplaceProductCard } from '../../shared/product-card';
import { SAMPLE_PRODUCTS, MARKETPLACE_CATEGORIES } from '../../shared/constants';
import { getProducts, getCategories, getLocalizedProduct } from '../../shared/api';
import { MarketplaceProductDetailDialog } from '../components/product-detail-dialog';

type PriceFilter = 'all' | 'free' | 'paid';

export function MarketplaceDashboardProductsView() {
  const { currentLang } = useTranslate();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedCategory = searchParams.get('category') || 'all';
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([...MARKETPLACE_CATEGORIES]);
  const [category, setCategory] = useState(requestedCategory);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('popular');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    setCategory(requestedCategory);
  }, [requestedCategory]);

  useEffect(() => {
    getCategories()
      .then(({ categories: categoryRows }) => {
        if (categoryRows.length) {
          setCategories(['all', ...categoryRows.map((item) => item.name)]);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const requestVersion = ++requestVersionRef.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await getProducts({
          q: search,
          category,
          price: priceFilter,
          page: 1,
          limit: 12,
        });
        if (requestVersion !== requestVersionRef.current) return;
        setProducts(result.products);
        setPage(1);
        setHasMore(Boolean(result.hasMore));
      } catch {
        if (requestVersion !== requestVersionRef.current) return;
        setProducts(SAMPLE_PRODUCTS);
        setPage(1);
        setHasMore(false);
      } finally {
        if (requestVersion === requestVersionRef.current) setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [category, priceFilter, search]);

  const loadMoreProducts = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const requestVersion = requestVersionRef.current;
    const nextPage = page + 1;
    setLoadingMore(true);

    try {
      const result = await getProducts({
        q: search,
        category,
        price: priceFilter,
        page: nextPage,
        limit: 12,
      });
      if (requestVersion !== requestVersionRef.current) return;
      setProducts((current) => {
        const currentIds = new Set(current.map((product) => product.id));
        return [...current, ...result.products.filter((product) => !currentIds.has(product.id))];
      });
      setPage(nextPage);
      setHasMore(Boolean(result.hasMore));
    } catch {
      if (requestVersion === requestVersionRef.current) setHasMore(false);
    } finally {
      if (requestVersion === requestVersionRef.current) setLoadingMore(false);
    }
  }, [category, hasMore, loading, loadingMore, page, priceFilter, search]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || loading || loadingMore || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreProducts();
      },
      { rootMargin: '320px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMoreProducts, loading, loadingMore]);

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
    requestVersionRef.current += 1;
    setLoading(true);
    setHasMore(false);
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
              label="Marketplace Catalog"
              color="primary"
              variant="soft"
              sx={{ mb: 1.5 }}
            />
            <Typography variant="h3">สินค้าทั้งหมด</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              ค้นหาและเลือกซื้อสื่อการสอนด้วยบัญชี E-KRU ของคุณ
            </Typography>
          </Box>

          <Chip
            icon={<RiApps2Line />}
            label={`${displayedProducts.length.toLocaleString('th-TH')} รายการ`}
            variant="outlined"
          />
        </Stack>

        <Card variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <TextField
                fullWidth
                value={search}
                placeholder="ค้นหาชื่อสินค้า วิชา หรือระดับชั้น..."
                onChange={(event) => {
                  requestVersionRef.current += 1;
                  setLoading(true);
                  setHasMore(false);
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
                aria-label="เรียงลำดับสินค้า"
                onChange={(event) => setSort(String(event.target.value))}
                startAdornment={<RiEqualizer2Line size={19} />}
                sx={{
                  gap: 1,
                  minWidth: { xs: 1, md: 190 },
                  borderRadius: 2,
                  '& .MuiSelect-select': { pl: 1 },
                }}
              >
                <MenuItem value="popular">ความนิยม</MenuItem>
                <MenuItem value="latest">ใหม่ล่าสุด</MenuItem>
                <MenuItem value="rating">คะแนนรีวิว</MenuItem>
                <MenuItem value="price-low">ราคาต่ำสุด</MenuItem>
              </Select>
            </Stack>

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              spacing={1.5}
            >
              <Box
                component="nav"
                aria-label="หมวดหมู่สินค้า"
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
                        {item === 'all' ? 'ทั้งหมด' : item}
                      </Button>
                    );
                  })}
                </Stack>
              </Box>

              <Stack
                direction="row"
                spacing={0.25}
                role="group"
                aria-label="กรองตามราคา"
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
                    ['all', 'ทุกราคา'],
                    ['free', 'ฟรี 0 บาท'],
                    ['paid', 'มีค่าใช้จ่าย'],
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
                        requestVersionRef.current += 1;
                        setLoading(true);
                        setHasMore(false);
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
                  กำลังโหลดสินค้าเพิ่ม...
                </Typography>
              </Stack>
            )}
          </Box>
        ) : (
          <Card variant="outlined" sx={{ py: 10, px: 3, textAlign: 'center', borderRadius: 3 }}>
            <RiSearchLine size={42} />
            <Typography variant="h5" sx={{ mt: 1.5 }}>
              ไม่พบสินค้าที่ค้นหา
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              ลองเปลี่ยนคำค้นหรือเลือกหมวดหมู่อื่น
            </Typography>
          </Card>
        )}
      </Stack>

      <MarketplaceProductDetailDialog
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </Container>
  );
}
