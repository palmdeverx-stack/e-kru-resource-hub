'use client';

import type { MarketplaceProduct } from '../../shared/types';

import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, useDeferredValue } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import InputAdornment from '@mui/material/InputAdornment';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';
import { brandColors } from 'src/theme/brand-colors';

import {
  RiFileLine,
  RiTeamLine,
  RiCloseLine,
  RiApps2Line,
  RiStore2Line,
  RiSearchLine,
  RiSchoolLine,
  RiCodeBoxLine,
  RiFileTextLine,
  RiBookOpenLine,
  RiSparklingLine,
  RiArrowRightLine,
  RiCheckboxMultipleLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { MarketplaceProductCard } from '../../shared/product-card';
import { getProducts, getLocalizedProduct } from '../../shared/api';

type Audience = 'all' | 'individual' | 'school';

const copy = {
  th: {
    eyebrow: 'MADE BY E-KRU',
    title: 'สื่อและแอปดี ๆ จากทีม E-KRU',
    description: 'รวมสื่อการสอน เทมเพลต แบบฟอร์ม และแอปจากทีม E-KRU เลือกใช้ให้เหมาะกับงานของคุณ',
    personalTitle: 'ใช้ในนามบุคคล',
    personalDescription: 'ซื้อและใช้สิทธิ์ด้วยบัญชีของคุณ ใช้งานต่อได้แม้ย้ายโรงเรียน',
    schoolTitle: 'ใช้ร่วมกันทั้งโรงเรียน',
    schoolDescription: 'เชื่อมข้อมูลนักเรียน บุคลากร ห้องเรียน และจัดการสิทธิ์จากส่วนกลาง',
    browse: 'เลือกดูสินค้า',
    helperTitle: 'เลือกแบบที่เหมาะกับคุณ',
    helperDescription: 'กดเลือกบุคคลหรือโรงเรียน เพื่อดูสินค้าที่ตรงกับการใช้งาน',
    audience: 'เลือกกลุ่มผู้ใช้งาน',
    allAudience: 'ทั้งหมด',
    individual: 'บุคคล',
    school: 'โรงเรียน',
    search: 'ค้นหาสื่อหรือแอปที่สนใจ',
    found: 'พบ {{count}} รายการ',
    emptyTitle: 'ยังไม่พบสินค้าที่ตรงกับตัวกรอง',
    emptyDescription: 'ลองเปลี่ยนประเภท กลุ่มผู้ใช้งาน หรือคำค้นหา',
    clear: 'ล้างตัวกรอง',
    retry: 'ลองอีกครั้ง',
    categories: 'ประเภทสินค้า',
    filters: 'ค้นหาและเลือกสินค้า',
    showing: 'แสดง {{shown}} จาก {{total}} รายการ',
    loadError: 'โหลดรายการไม่สำเร็จ กรุณาลองอีกครั้ง',
  },
  en: {
    eyebrow: 'MADE BY E-KRU',
    title: 'Useful tools for teachers and schools',
    description:
      'Discover ready-to-use templates, files, forms, learning resources, and apps for individuals and schools.',
    personalTitle: 'For individuals',
    personalDescription: 'Purchase with your own account and keep access when you move schools.',
    schoolTitle: 'For schools',
    schoolDescription: 'Connect student, staff, and classroom data with centrally managed access.',
    browse: 'Browse products',
    helperTitle: 'Find what works for you',
    helperDescription: 'Choose individuals or schools to explore products for your needs.',
    audience: 'Choose an audience',
    allAudience: 'All',
    individual: 'Individual',
    school: 'School',
    search: 'Search resources or tools',
    found: '{{count}} products',
    emptyTitle: 'No products match these filters',
    emptyDescription: 'Try another type, audience, or search term.',
    clear: 'Clear filters',
    retry: 'Try again',
    categories: 'Product type',
    filters: 'Find your products',
    showing: 'Showing {{shown}} of {{total}} products',
    loadError: 'Resources and tools could not be loaded right now.',
  },
} as const;

function getCategoryIcon(category: string) {
  const normalized = category.toLowerCase();
  if (/prompt|artificial intelligence|(^|\s)ai($|\s)|ปัญญาประดิษฐ์/.test(normalized)) {
    return RiSparklingLine;
  }
  if (/seller|store|marketplace|ผู้ขาย|ร้านค้า/.test(normalized)) return RiStore2Line;
  if (/software|system|ซอฟต์แวร์|ระบบการศึกษา/.test(normalized)) return RiCodeBoxLine;
  if (/quiz|test|form|แบบทดสอบ|แบบฟอร์ม|แบบประเมิน/.test(normalized)) {
    return RiCheckboxMultipleLine;
  }
  if (/course|lesson|learning|คอร์ส|บทเรียน|แผนการสอน/.test(normalized)) {
    return RiBookOpenLine;
  }
  if (/file|worksheet|ไฟล์|ใบงาน/.test(normalized)) return RiFileLine;
  if (/app|tool|แอป|เครื่องมือ/.test(normalized)) return RiApps2Line;
  return RiFileTextLine;
}

function matchesAudience(product: MarketplaceProduct, audience: Audience) {
  if (audience === 'all') return true;
  if (audience === 'school') {
    return product.license_scope === 'school' || product.license_scope === 'platform';
  }
  return product.license_scope === 'individual' || product.license_scope === 'teacher';
}

export function OfficialProductsView() {
  const { currentLang } = useTranslate();
  const language = currentLang.value === 'en' ? 'en' : 'th';
  const text = copy[language];
  const { user } = useAuthContext();
  const {
    data: products = [],
    isPending: loading,
    isError: loadError,
    refetch,
  } = useQuery({
    queryKey: ['official-products', user?.id ?? 'guest', user?.role ?? 'guest'],
    queryFn: async () => (await getProducts({ official: true, page: 1, limit: 48 })).products,
    staleTime: 60_000,
  });
  const [category, setCategory] = useState('all');
  const [audience, setAudience] = useState<Audience>('all');
  const [search, setSearch] = useState('');

  const deferredSearch = useDeferredValue(search);
  const [displayLimit, setDisplayLimit] = useState(12);

  const categories = useMemo(
    () => [
      'all',
      ...Array.from(
        new Set(products.map((product) => product.category.trim()).filter(Boolean))
      ).sort((first, second) => first.localeCompare(second, language === 'th' ? 'th' : 'en')),
    ],
    [language, products]
  );

  const visibleProducts = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    return products.filter((product) => {
      const localized = getLocalizedProduct(product, language);
      const searchableText = [
        localized.title,
        localized.description,
        product.category,
        product.media_type?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return (
        (category === 'all' || product.category.trim() === category) &&
        matchesAudience(product, audience) &&
        (!normalizedSearch || searchableText.includes(normalizedSearch))
      );
    });
  }, [audience, category, language, products, deferredSearch]);

  const resetFilters = () => {
    setCategory('all');
    setAudience('all');
    setSearch('');
    setDisplayLimit(12);
  };

  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        color: 'text.primary',
      }}
    >
      <Box
        sx={(theme) => ({
          bgcolor: brandColors.surface,
          backgroundImage: brandColors.heroBackground,
          borderBottom: '1px solid',
          borderColor: 'divider',
          ...theme.applyStyles('dark', { bgcolor: 'background.neutral', backgroundImage: 'none' }),
        })}
      >
        <Container maxWidth="lg" sx={{ pt: { xs: 4, md: 5 }, pb: { xs: 3, md: 4 } }}>
          <Grid container spacing={{ xs: 2, md: 5 }} alignItems="center">
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack spacing={2} alignItems="flex-start">
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ color: 'primary.main' }}
                >
                  <RiBookOpenLine size={20} aria-hidden />
                  <Typography variant="overline" sx={{ letterSpacing: 1, fontSize: 11 }}>
                    {text.eyebrow}
                  </Typography>
                </Stack>
                <Typography
                  component="h1"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: 30, sm: 36, md: 42 },
                    lineHeight: 1.35,
                    maxWidth: 640,
                    textWrap: 'balance',
                  }}
                >
                  {text.title}
                </Typography>
                <Typography
                  color="text.secondary"
                  sx={{ maxWidth: 600, fontSize: { xs: 16, md: 17 }, lineHeight: 1.8 }}
                >
                  {text.description}
                </Typography>
                <Button
                  variant="contained"
                  href="#official-products"
                  endIcon={<RiArrowRightLine />}
                  sx={{
                    minHeight: 44,
                    boxShadow: 'none',
                    borderRadius: 1.5,
                    '&:hover': { boxShadow: 'none' },
                  }}
                >
                  {text.browse}
                </Button>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box
                sx={{
                  position: 'relative',
                  mx: 'auto',
                  width: { xs: 160, sm: 200, md: 240 },
                  aspectRatio: '1 / 1',
                }}
              >
                <Image
                  src="/assets/mascot/kumi_cute.png"
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 900px) 240px, (min-width: 600px) 200px, 160px"
                  style={{ objectFit: 'contain' }}
                />
              </Box>
            </Grid>
          </Grid>
          <Box sx={{ mt: { xs: 3, md: 4 } }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              {text.helperTitle}
            </Typography>
            <Grid container spacing={1.5}>
              {[
                {
                  icon: RiTeamLine,
                  audience: 'individual' as const,
                  title: text.personalTitle,
                  description: text.personalDescription,
                },
                {
                  icon: RiSchoolLine,
                  audience: 'school' as const,
                  title: text.schoolTitle,
                  description: text.schoolDescription,
                },
              ].map((item) => (
                <Grid key={item.audience} size={{ xs: 12, sm: 6 }}>
                  <Paper
                    component="a"
                    href="#official-products"
                    onClick={() => {
                      setAudience(item.audience);
                      setDisplayLimit(12);
                    }}
                    sx={{
                      p: { xs: 2, md: 2.5 },
                      height: 1,
                      display: 'flex',
                      gap: 1.5,
                      alignItems: 'flex-start',
                      borderRadius: 2,
                      textDecoration: 'none',
                      color: 'text.primary',
                      bgcolor: 'background.paper',
                      boxShadow: 'none',
                      border: '1px solid',
                      borderColor: audience === item.audience ? 'primary.main' : 'divider',
                      transition: 'border-color 160ms ease',
                      '&:hover': { borderColor: 'primary.main' },
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: 3,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'background.neutral',
                        color: 'primary.main',
                        borderRadius: 1.5,
                        flexShrink: 0,
                      }}
                    >
                      <item.icon size={22} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1">{item.title}</Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.5, lineHeight: 1.7 }}
                      >
                        {item.description}
                      </Typography>
                    </Box>
                    <RiArrowRightLine
                      size={20}
                      style={{ flexShrink: 0, marginTop: 8 }}
                      aria-hidden
                    />
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Container>
      </Box>

      <Container
        id="official-products"
        tabIndex={-1}
        maxWidth="lg"
        sx={{ py: { xs: 3, md: 5 }, scrollMarginTop: 96 }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={{ xs: 3, md: 4 }}
          alignItems="flex-start"
        >
          <Paper
            component="aside"
            aria-label={text.filters}
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 2,
              width: { xs: 1, md: 270 },
              flexShrink: 0,
              position: { md: 'sticky' },
              top: { md: 96 },
            }}
          >
            <Stack spacing={1.5}>
              <Stack
                direction="column"
                spacing={1.5}
                alignItems="stretch"
                justifyContent="space-between"
              >
                <Typography component="h2" variant="subtitle1">
                  {text.filters}
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    size="small"
                    value={search}
                    placeholder={text.search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setDisplayLimit(12);
                    }}
                    slotProps={{
                      htmlInput: { 'aria-label': text.search },
                      input: {
                        endAdornment: search ? (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              aria-label={text.clear}
                              onClick={() => {
                                setSearch('');
                                setDisplayLimit(12);
                              }}
                            >
                              <RiCloseLine size={18} />
                            </IconButton>
                          </InputAdornment>
                        ) : undefined,
                        startAdornment: (
                          <InputAdornment position="start">
                            <RiSearchLine />
                          </InputAdornment>
                        ),
                      },
                    }}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': { minHeight: 38, borderRadius: 1.5 },
                      '& input': { fontSize: 14 },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {text.audience}
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={audience}
                    aria-label={text.audience}
                    sx={{
                      p: 0.5,
                      gap: 0.5,
                      bgcolor: 'background.neutral',
                      borderRadius: 999,
                      border: 0,
                      '&& .MuiToggleButton-root': {
                        border: 0,
                        borderRadius: 999,
                        m: 0,
                        flex: 1,
                        px: 1,
                        minHeight: 44,
                        whiteSpace: 'nowrap',
                        fontSize: 13,
                        color: 'text.secondary',
                        '&.Mui-selected': {
                          bgcolor: 'background.paper',
                          color: 'primary.main',
                          boxShadow: '0 1px 4px rgba(15,23,42,0.10)',
                          '&:hover': { bgcolor: 'background.paper' },
                        },
                      },
                    }}
                    onChange={(_, value: Audience | null) => {
                      if (value) {
                        setAudience(value);
                        setDisplayLimit(12);
                      }
                    }}
                  >
                    <ToggleButton value="all">{text.allAudience}</ToggleButton>
                    <ToggleButton value="individual">{text.individual}</ToggleButton>
                    <ToggleButton value="school">{text.school}</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
              </Stack>

              {!loading && !loadError && products.length > 0 && (
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 1 }}
                  >
                    {text.categories}
                  </Typography>
                  <Stack spacing={0.75}>
                    {categories.map((item) => {
                      const CategoryIcon = item === 'all' ? RiApps2Line : getCategoryIcon(item);
                      return (
                        <Chip
                          key={item}
                          icon={<CategoryIcon size={18} />}
                          label={item === 'all' ? text.allAudience : item}
                          onClick={() => {
                            setCategory(item);
                            setDisplayLimit(12);
                          }}
                          variant="outlined"
                          color={category === item ? 'primary' : 'default'}
                          aria-pressed={category === item}
                          sx={{
                            minHeight: 40,
                            width: 1,
                            borderRadius: 999,
                            justifyContent: 'flex-start',
                            borderColor: category === item ? 'primary.light' : 'divider',
                            bgcolor: category === item ? 'primary.lighter' : 'background.paper',
                            color: category === item ? 'primary.dark' : 'text.secondary',
                            '& .MuiChip-icon': { color: 'inherit', ml: 1.25 },
                            '& .MuiChip-label': {
                              whiteSpace: 'normal',
                              py: 0.75,
                              fontSize: 13,
                              lineHeight: 1.6,
                            },
                            height: 'auto',
                          }}
                        />
                      );
                    })}
                  </Stack>
                </Box>
              )}

              {(category !== 'all' || audience !== 'all' || search) && (
                <Button
                  size="small"
                  onClick={resetFilters}
                  startIcon={<RiCloseLine />}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {text.clear}
                </Button>
              )}
            </Stack>
          </Paper>
          <Stack spacing={2.5} sx={{ flex: 1, minWidth: 0, width: 1 }}>
            <Box>
              <Typography component="h2" variant="h5">
                {text.browse}
              </Typography>
              {!loading && !loadError && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  aria-live="polite"
                  sx={{ mt: 0.5 }}
                >
                  {text.found.replace(
                    '{{count}}',
                    visibleProducts.length.toLocaleString(currentLang.numberFormat.code)
                  )}
                </Typography>
              )}
            </Box>

            {loading ? (
              <Grid container spacing={{ xs: 2, md: 2.5 }}>
                {Array.from({ length: 8 }).map((_, index) => (
                  <Grid key={index} size={{ xs: 12, sm: 6, lg: 4 }}>
                    <Paper variant="outlined" sx={{ p: 1.25 }}>
                      <Skeleton variant="rounded" sx={{ aspectRatio: '16 / 11' }} />
                      <Skeleton width="48%" sx={{ mt: 2 }} />
                      <Skeleton height={32} />
                      <Skeleton width="72%" />
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            ) : loadError ? (
              <Paper variant="outlined" sx={{ p: 5, textAlign: 'center' }}>
                <Typography color="error.main">{text.loadError}</Typography>
                <Button
                  variant="outlined"
                  onClick={() => {
                    void refetch();
                  }}
                  sx={{ mt: 2 }}
                >
                  {text.retry}
                </Button>
              </Paper>
            ) : visibleProducts.length ? (
              <Grid container spacing={{ xs: 2, md: 2.5 }}>
                {visibleProducts.slice(0, displayLimit).map((product, index) => (
                  <Grid key={product.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MarketplaceProductCard product={product} colorIndex={index} />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Paper variant="outlined" sx={{ p: { xs: 4, md: 7 }, textAlign: 'center' }}>
                <Box sx={{ width: 132, aspectRatio: '1 / 1', position: 'relative', mx: 'auto' }}>
                  <Image
                    src="/assets/mascot/kumi_question.png"
                    alt=""
                    fill
                    sizes="132px"
                    style={{ objectFit: 'contain' }}
                  />
                </Box>
                <Typography variant="h5" sx={{ mt: 2 }}>
                  {text.emptyTitle}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {text.emptyDescription}
                </Typography>
                <Button onClick={resetFilters} sx={{ mt: 2 }}>
                  {text.clear}
                </Button>
              </Paper>
            )}

            {!loading && !loadError && visibleProducts.length > displayLimit && (
              <Button variant="outlined" onClick={() => setDisplayLimit((value) => value + 12)}>
                {language === 'en' ? 'Show more products' : 'แสดงสินค้าเพิ่มเติม'}
              </Button>
            )}

            {!loading && !loadError && visibleProducts.length > 0 && (
              <Typography variant="caption" color="text.secondary" textAlign="center">
                {text.showing
                  .replace('{{shown}}', String(Math.min(displayLimit, visibleProducts.length)))
                  .replace('{{total}}', String(visibleProducts.length))}
              </Typography>
            )}
            <Stack direction="row" justifyContent="center">
              <Button component={RouterLink} href={paths.marketplace.products} color="inherit">
                {language === 'en'
                  ? 'View all marketplace products'
                  : 'ดูสินค้าทั้งหมดใน Marketplace'}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
