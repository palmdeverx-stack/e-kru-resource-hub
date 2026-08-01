'use client';

import type { MarketplaceProduct } from '../../shared/types';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import InputAdornment from '@mui/material/InputAdornment';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import {
  RiFileLine,
  RiTeamLine,
  RiApps2Line,
  RiStore2Line,
  RiSearchLine,
  RiSchoolLine,
  RiCodeBoxLine,
  RiFileTextLine,
  RiBookOpenLine,
  RiSparklingLine,
  RiArrowRightLine,
  RiShieldStarFill,
  RiCheckboxMultipleLine,
} from 'src/components/remix-icon';

import { MarketplaceProductCard } from '../../shared/product-card';
import { getProducts, getLocalizedProduct } from '../../shared/api';

type Audience = 'all' | 'individual' | 'school';

const copy = {
  th: {
    eyebrow: 'OFFICIAL E-KRU PRODUCTS',
    title: 'เครื่องมือและทรัพยากรทางการจาก E-KRU',
    description:
      'เลือก Templates, Files, Forms, Learning Resources และแอปที่ออกแบบให้ครูใช้ได้ทันที ทั้งแบบบุคคลและแบบโรงเรียน',
    personalTitle: 'ใช้ในนามบุคคล',
    personalDescription: 'ซื้อและใช้สิทธิ์ด้วยบัญชีของคุณ ใช้งานต่อได้แม้ย้ายโรงเรียน',
    schoolTitle: 'ใช้ร่วมกันทั้งโรงเรียน',
    schoolDescription: 'เชื่อมข้อมูลนักเรียน บุคลากร ห้องเรียน และจัดการสิทธิ์จากส่วนกลาง',
    browse: 'เลือกดูสินค้า',
    audience: 'เลือกกลุ่มผู้ใช้งาน',
    allAudience: 'ทั้งหมด',
    individual: 'บุคคล',
    school: 'โรงเรียน',
    search: 'ค้นหาสินค้าทางการ',
    found: 'พบ {{count}} รายการ',
    emptyTitle: 'ยังไม่พบสินค้าที่ตรงกับตัวกรอง',
    emptyDescription: 'ลองเปลี่ยนประเภท กลุ่มผู้ใช้งาน หรือคำค้นหา',
    clear: 'ล้างตัวกรอง',
    loadError: 'ไม่สามารถโหลดสินค้าทางการได้ในขณะนี้',
  },
  en: {
    eyebrow: 'OFFICIAL E-KRU PRODUCTS',
    title: 'Official tools and resources from E-KRU',
    description:
      'Discover ready-to-use templates, files, forms, learning resources, and apps for individuals and schools.',
    personalTitle: 'For individuals',
    personalDescription: 'Purchase with your own account and keep access when you move schools.',
    schoolTitle: 'For schools',
    schoolDescription: 'Connect student, staff, and classroom data with centrally managed access.',
    browse: 'Browse products',
    audience: 'Choose an audience',
    allAudience: 'All',
    individual: 'Individual',
    school: 'School',
    search: 'Search official products',
    found: '{{count}} products',
    emptyTitle: 'No products match these filters',
    emptyDescription: 'Try another type, audience, or search term.',
    clear: 'Clear filters',
    loadError: 'Official products could not be loaded right now.',
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
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [category, setCategory] = useState('all');
  const [audience, setAudience] = useState<Audience>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getProducts({ official: true, page: 1, limit: 48 })
      .then(({ products: officialProducts }) => {
        setProducts(officialProducts);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

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
    const normalizedSearch = search.trim().toLowerCase();
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
  }, [audience, category, language, products, search]);

  const resetFilters = () => {
    setCategory('all');
    setAudience('all');
    setSearch('');
  };

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <Box
        sx={{
          color: 'common.white',
          overflow: 'hidden',
          position: 'relative',
          background:
            'radial-gradient(circle at 82% 18%, rgba(94,234,212,0.22), transparent 27%), linear-gradient(135deg, #102A56 0%, #1555A2 54%, #087F8C 100%)',
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
          <Grid container spacing={{ xs: 4, md: 7 }} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={2.5} alignItems="flex-start">
                <Chip
                  icon={<RiShieldStarFill />}
                  label={text.eyebrow}
                  sx={{
                    color: 'common.white',
                    fontWeight: 800,
                    bgcolor: 'rgba(255,255,255,0.13)',
                    '& .MuiChip-icon': { color: '#72E2D1' },
                  }}
                />
                <Typography variant="h1" sx={{ maxWidth: 760, fontSize: { xs: 38, md: 58 } }}>
                  {text.title}
                </Typography>
                <Typography sx={{ maxWidth: 700, fontSize: { xs: 17, md: 20 }, opacity: 0.82 }}>
                  {text.description}
                </Typography>
                <Button
                  size="large"
                  variant="contained"
                  color="white"
                  href="#official-products"
                  endIcon={<RiArrowRightLine />}
                  sx={{ color: '#123A72' }}
                >
                  {text.browse}
                </Button>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Stack spacing={2}>
                {[
                  {
                    icon: RiTeamLine,
                    title: text.personalTitle,
                    description: text.personalDescription,
                  },
                  {
                    icon: RiSchoolLine,
                    title: text.schoolTitle,
                    description: text.schoolDescription,
                  },
                ].map((item) => (
                  <Paper
                    key={item.title}
                    sx={{
                      p: 2.5,
                      color: 'common.white',
                      border: '1px solid rgba(255,255,255,0.18)',
                      bgcolor: 'rgba(255,255,255,0.10)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <Stack direction="row" spacing={2}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          display: 'grid',
                          flexShrink: 0,
                          borderRadius: 1.5,
                          placeItems: 'center',
                          bgcolor: 'rgba(255,255,255,0.14)',
                        }}
                      >
                        <item.icon size={25} />
                      </Box>
                      <Box>
                        <Typography variant="h6">{item.title}</Typography>
                        <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.75 }}>
                          {item.description}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container id="official-products" maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
        <Stack spacing={4}>
          <Grid container spacing={2}>
            {categories.map((item) => {
              const selected = category === item;
              const CategoryIcon = item === 'all' ? RiShieldStarFill : getCategoryIcon(item);
              return (
                <Grid key={item} size={{ xs: 6, sm: 4, md: 2 }}>
                  <Paper
                    component="button"
                    type="button"
                    onClick={() => setCategory(item)}
                    aria-pressed={selected}
                    sx={{
                      p: 2,
                      width: 1,
                      height: 1,
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: selected ? 'primary.main' : 'text.primary',
                      border: '1px solid',
                      borderColor: selected ? 'primary.main' : 'divider',
                      bgcolor: selected ? 'primary.lighter' : 'background.paper',
                      transition: 'transform 180ms ease, border-color 180ms ease',
                      '&:hover': { transform: 'translateY(-3px)', borderColor: 'primary.main' },
                    }}
                  >
                    <CategoryIcon size={25} />
                    <Typography variant="subtitle2" sx={{ mt: 1 }}>
                      {item === 'all' ? text.allAudience : item}
                    </Typography>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h4">{text.browse}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {text.found.replace('{{count}}', String(visibleProducts.length))}
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                size="small"
                value={search}
                placeholder={text.search}
                onChange={(event) => setSearch(event.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <RiSearchLine />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ minWidth: { sm: 260 } }}
              />
              <ToggleButtonGroup
                exclusive
                size="small"
                value={audience}
                aria-label={text.audience}
                onChange={(_, value: Audience | null) => value && setAudience(value)}
              >
                <ToggleButton value="all">{text.allAudience}</ToggleButton>
                <ToggleButton value="individual">{text.individual}</ToggleButton>
                <ToggleButton value="school">{text.school}</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>

          {loading ? (
            <Grid container spacing={2.5}>
              {Array.from({ length: 8 }).map((_, index) => (
                <Grid key={index} size={{ xs: 12, sm: 6, md: 3 }}>
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
            </Paper>
          ) : visibleProducts.length ? (
            <Grid container spacing={2.5}>
              {visibleProducts.map((product, index) => (
                <Grid key={product.id} size={{ xs: 12, sm: 6, md: 3 }}>
                  <MarketplaceProductCard product={product} colorIndex={index} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Paper variant="outlined" sx={{ p: { xs: 4, md: 7 }, textAlign: 'center' }}>
              <RiSearchLine size={40} />
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

          <Stack direction="row" justifyContent="center">
            <Button component={RouterLink} href={paths.marketplace.products} color="inherit">
              {language === 'en'
                ? 'View all marketplace products'
                : 'ดูสินค้าทั้งหมดใน Marketplace'}
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
