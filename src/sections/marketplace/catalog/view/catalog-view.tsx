'use client';

import type { MarketplaceProduct } from '../../shared/types';

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { useTranslate } from 'src/locales';

import {
  RiSearchLine,
  RiStore2Line,
  RiBookOpenLine,
  RiArrowLeftSLine,
  RiShieldCheckLine,
  RiArrowRightSLine,
  RiGraduationCapLine,
} from 'src/components/remix-icon';

import { MarketplaceProductCard } from '../../shared/product-card';
import { MarketplaceNewProductCard } from '../components/new-product-card';
import { SAMPLE_PRODUCTS, MARKETPLACE_CATEGORIES } from '../../shared/constants';
import { getProducts, getCategories, getLocalizedProduct } from '../../shared/api';
import { MarketplaceProductDetailDialog } from '../components/product-detail-dialog';

type PublicStats = {
  teachers: number;
  schools: number;
  externalMembers: number;
};

const formatCount = (value: number) => new Intl.NumberFormat('th-TH').format(value);

export function MarketplaceCatalogView() {
  const { currentLang } = useTranslate();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedCategory = searchParams.get('category') || 'all';
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [productPage, setProductPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(requestedCategory);
  const [sort, setSort] = useState('popular');
  const [categories, setCategories] = useState<string[]>([...MARKETPLACE_CATEGORIES]);
  const [newProducts, setNewProducts] = useState<MarketplaceProduct[]>([]);
  const [newProductsLoading, setNewProductsLoading] = useState(true);
  const [publicStats, setPublicStats] = useState<PublicStats | null>(null);
  const [publicStatsLoading, setPublicStatsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const newProductsScrollRef = useRef<HTMLDivElement | null>(null);
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
      .catch(() => {
        // Keep the built-in category fallback while the master schema is being installed.
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/marketplace/public-stats', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('โหลดสถิติไม่สำเร็จ');
        return response.json() as Promise<PublicStats>;
      })
      .then(setPublicStats)
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setPublicStats(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPublicStatsLoading(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    getProducts({ page: 1, limit: 12 })
      .then(({ products: latestProducts }) => setNewProducts(latestProducts))
      .catch(() => setNewProducts(SAMPLE_PRODUCTS.slice(0, 12)))
      .finally(() => setNewProductsLoading(false));
  }, []);

  useEffect(() => {
    const requestVersion = ++requestVersionRef.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await getProducts({ q: search, category, page: 1, limit: 12 });
        if (requestVersion !== requestVersionRef.current) return;
        setProducts(result.products);
        setProductPage(1);
        setHasMore(Boolean(result.hasMore));
      } catch {
        if (requestVersion !== requestVersionRef.current) return;
        setProducts(SAMPLE_PRODUCTS);
        setProductPage(1);
        setHasMore(false);
      } finally {
        if (requestVersion === requestVersionRef.current) setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [category, search]);

  const loadMoreProducts = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const requestVersion = requestVersionRef.current;
    const nextPage = productPage + 1;
    setLoadingMore(true);
    try {
      const result = await getProducts({
        q: search,
        category,
        page: nextPage,
        limit: 12,
      });
      if (requestVersion !== requestVersionRef.current) return;
      setProducts((current) => {
        const existingIds = new Set(current.map((product) => product.id));
        return [...current, ...result.products.filter((product) => !existingIds.has(product.id))];
      });
      setProductPage(nextPage);
      setHasMore(Boolean(result.hasMore));
    } catch {
      if (requestVersion === requestVersionRef.current) setHasMore(false);
    } finally {
      if (requestVersion === requestVersionRef.current) setLoadingMore(false);
    }
  }, [category, hasMore, loading, loadingMore, productPage, search]);

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

  const visibleProducts = products.filter(
    (product) =>
      (category === 'all' || product.category === category) &&
      (!search ||
        getLocalizedProduct(product, currentLang.value)
          .title.toLowerCase()
          .includes(search.toLowerCase()))
  );
  const displayedProducts = loading && products.length ? products : visibleProducts;
  const sortedDisplayedProducts = useMemo(() => {
    const sorted = [...displayedProducts];

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
  }, [displayedProducts, sort]);

  const handleCategoryChange = (nextCategory: string) => {
    if (nextCategory === category) return;
    requestVersionRef.current += 1;
    setLoading(true);
    setHasMore(false);
    setCategory(nextCategory);
    router.replace(
      nextCategory === 'all'
        ? paths.marketplace.products
        : `${paths.marketplace.products}?category=${encodeURIComponent(nextCategory)}`,
      { scroll: false }
    );
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
                <Chip icon={<RiGraduationCapLine />} label="จากครู เพื่อการเรียนรู้ที่ดีขึ้น" />
                <Typography
                  component="h1"
                  variant="h1"
                  sx={{ fontSize: { xs: 42, md: 68 }, textAlign: { xs: 'center', md: 'left' } }}
                >
                  สื่อการสอนดี ๆ
                  <Box component="span" sx={{ color: 'primary.main' }}>
                    {' '}
                    อยู่ที่นี่
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
                  ค้นหา ซื้อ และขายแผนการสอน ใบงาน แบบทดสอบ และสื่อคุณภาพจากชุมชนการศึกษา eKru
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    size="large"
                    variant="contained"
                    href="#products"
                    startIcon={<RiBookOpenLine />}
                  >
                    เลือกดูสื่อ
                  </Button>
                  <Button
                    size="large"
                    variant="outlined"
                    component={RouterLink}
                    href={paths.marketplace.seller}
                    startIcon={<RiStore2Line />}
                  >
                    เปิดร้านขายสื่อ
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
                  <Typography variant="h3">บัญชีเดียวกับ E-KRU</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.76)' }}>
                    ครูใช้บัญชีเดิมได้ทันที บุคคลทั่วไปสมัครใหม่ได้
                    และทุกคนสามารถเปิดร้านขายผลงานของตัวเอง
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
                      <Typography variant="caption">ครูและสมาชิก</Typography>
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
                      <Typography variant="caption">โรงเรียนในระบบ</Typography>
                    </Box>
                  </Stack>
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container id="products" maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
        <Stack spacing={4}>
          <Box>
            <Typography variant="h3">เลือกดูผลิตภัณฑ์ของเรา</Typography>
            <Typography sx={{ mt: 1, color: 'text.secondary' }}>
              ค้นหาสื่อที่เหมาะกับห้องเรียนจากหมวดหมู่ Marketplace
            </Typography>
          </Box>

          <Stack spacing={1.5}>
            <TextField
              fullWidth
              value={search}
              placeholder="ค้นหาสื่อ วิชา หรือระดับชั้น..."
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
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2.5,
                  bgcolor: 'background.paper',
                },
              }}
            />

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'stretch', md: 'center' }}
              spacing={2}
            >
              <Box
                component="nav"
                aria-label="หมวดหมู่สื่อการสอน"
                sx={{
                  width: 1,
                  overflowX: 'auto',
                  scrollbarWidth: 'thin',
                  '&::-webkit-scrollbar': { height: 4 },
                  '&::-webkit-scrollbar-thumb': {
                    borderRadius: 4,
                    bgcolor: 'divider',
                  },
                }}
              >
                <Stack direction="row" spacing={{ xs: 2, md: 3 }} sx={{ width: 'max-content' }}>
                  {categories.map((item) => {
                    const active = category === item;
                    return (
                      <Button
                        key={item}
                        type="button"
                        color="inherit"
                        variant="text"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => handleCategoryChange(item)}
                        sx={{
                          px: 0,
                          pb: 1.25,
                          minWidth: 0,
                          flexShrink: 0,
                          borderRadius: 0,
                          color: active ? 'text.primary' : 'text.secondary',
                          fontWeight: active ? 700 : 500,
                          borderBottom: '2px solid',
                          borderColor: active ? 'primary.main' : 'transparent',
                          '&:hover': {
                            color: 'text.primary',
                            bgcolor: 'transparent',
                            borderColor: active ? 'primary.main' : 'divider',
                          },
                        }}
                      >
                        {item === 'all' ? 'ทั้งหมด' : item}
                      </Button>
                    );
                  })}
                </Stack>
              </Box>

              <Select
                size="small"
                value={sort}
                aria-label="เรียงลำดับสินค้า"
                onChange={(event) => setSort(String(event.target.value))}
                sx={{
                  minWidth: { xs: 1, md: 160 },
                  flexShrink: 0,
                  borderRadius: 2.5,
                  bgcolor: 'background.paper',
                }}
              >
                <MenuItem value="popular">ความนิยม</MenuItem>
                <MenuItem value="latest">ใหม่ล่าสุด</MenuItem>
                <MenuItem value="rating">คะแนนรีวิว</MenuItem>
                <MenuItem value="price-low">ราคาต่ำสุด</MenuItem>
              </Select>
            </Stack>
          </Stack>

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
                  <Grid
                    key={product.id}
                    size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
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
            <Box sx={{ py: 10, textAlign: 'center' }}>
              <Typography variant="h5">ไม่พบสื่อที่ค้นหา</Typography>
              <Typography color="text.secondary">ลองเปลี่ยนคำค้นหรือเลือกหมวดหมู่อื่น</Typography>
            </Box>
          )}
        </Stack>
        <Divider sx={{ my: { xs: 6, md: 9 } }} />
        <Box component="section" aria-labelledby="new-products-title">
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={2}
            sx={{ mb: 3 }}
          >
            <Box>
              <Typography id="new-products-title" variant="h3">
                มีอะไรใหม่ใน E-KRU Marketplace
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                อัปเดตสื่อการสอนและผลิตภัณฑ์ใหม่จากผู้ขายในชุมชน
              </Typography>
            </Box>

            {newProducts.length > 1 && (
              <Stack direction="row" spacing={1}>
                <IconButton
                  aria-label="ดูสินค้าก่อนหน้า"
                  onClick={() =>
                    newProductsScrollRef.current?.scrollBy({
                      left: -Math.min(newProductsScrollRef.current.clientWidth * 0.85, 960),
                      behavior: 'smooth',
                    })
                  }
                  sx={{ border: '1px solid', borderColor: 'divider' }}
                >
                  <RiArrowLeftSLine />
                </IconButton>
                <IconButton
                  aria-label="ดูสินค้าถัดไป"
                  onClick={() =>
                    newProductsScrollRef.current?.scrollBy({
                      left: Math.min(newProductsScrollRef.current.clientWidth * 0.85, 960),
                      behavior: 'smooth',
                    })
                  }
                  sx={{ border: '1px solid', borderColor: 'divider' }}
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
          ) : (
            <Box
              ref={newProductsScrollRef}
              sx={{
                pb: 1.5,
                gap: 2.5,
                display: 'grid',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                gridAutoFlow: 'column',
                gridAutoColumns: {
                  xs: '88%',
                  sm: '58%',
                  md: 'calc((100% - 48px) / 3)',
                  lg: 'calc((100% - 48px) / 4)',
                },
                scrollbarWidth: 'thin',
                '&::-webkit-scrollbar': { height: 5 },
                '&::-webkit-scrollbar-thumb': {
                  borderRadius: 4,
                  bgcolor: 'divider',
                },
              }}
            >
              {newProducts.map((newProduct, index) => (
                <Box
                  key={newProduct.id}
                  onClickCapture={(event) => {
                    if ((event.target as HTMLElement).closest('[data-marketplace-seller-link]')) {
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedProduct(newProduct);
                  }}
                  sx={{ scrollSnapAlign: 'start' }}
                >
                  <MarketplaceNewProductCard product={newProduct} colorIndex={index} />
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <MarketplaceProductDetailDialog
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      </Container>
    </>
  );
}
