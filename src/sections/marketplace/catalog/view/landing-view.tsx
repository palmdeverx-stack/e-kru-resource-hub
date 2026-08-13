'use client';

import type { RemixiconComponentType } from '@remixicon/react';
import type { MarketplaceProduct } from '../../shared/types';
import type { MarketplaceLandingBanner } from '../../shared/landing-banner-types';

import Image from 'next/image';
import Autoplay from 'embla-carousel-autoplay';
import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Rating from '@mui/material/Rating';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import Accordion from '@mui/material/Accordion';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import {
  Carousel,
  useCarousel,
  CarouselDotButtons,
  CarouselArrowFloatButtons,
} from 'src/components/carousel';
import {
  RiStarLine,
  RiFireFill,
  RiLockLine,
  RiTimeLine,
  RiDraftLine,
  RiSearchLine,
  RiSchoolLine,
  RiStore2Line,
  RiUserAddLine,
  RiWallet3Line,
  RiPaletteLine,
  RiDownloadLine,
  RiUserStarLine,
  RiBookOpenLine,
  RiBookReadLine,
  RiFileList3Line,
  RiShieldStarFill,
  RiArrowRightLine,
  RiArrowDownSLine,
  RiUploadCloudLine,
  RiShieldCheckLine,
  RiCalendarTodoLine,
  RiPresentationLine,
  RiShoppingBag3Line,
  RiQuestionnaireLine,
  RiGraduationCapLine,
  RiMoneyDollarCircleLine,
} from 'src/components/remix-icon';

import { getProducts } from '../../shared/api';
import { MarketplaceProductCard } from '../../shared/product-card';

type LandingCategory = {
  id: string;
  name: string;
  description: string | null;
  count: number;
  previewImages: string[];
  translationKey?: string;
};

const fallbackCategories: LandingCategory[] = [
  {
    id: 'lesson-plans',
    name: 'แผนการสอน',
    description: null,
    count: 0,
    previewImages: [],
    translationKey: 'lessonPlans',
  },
  {
    id: 'worksheets',
    name: 'ใบงาน',
    description: null,
    count: 0,
    previewImages: [],
    translationKey: 'worksheets',
  },
  {
    id: 'supplementary',
    name: 'สื่อประกอบ',
    description: null,
    count: 0,
    previewImages: [],
    translationKey: 'supplementary',
  },
  {
    id: 'quizzes',
    name: 'แบบทดสอบ',
    description: null,
    count: 0,
    previewImages: [],
    translationKey: 'quizzes',
  },
  {
    id: 'courses',
    name: 'คอร์สเรียน',
    description: null,
    count: 0,
    previewImages: [],
    translationKey: 'courses',
  },
];

const categoryPalettes = [
  {
    background: 'linear-gradient(145deg, #E7F1FF 0%, #D6E8FF 100%)',
    foreground: '#163B6D',
    accent: '#2878D7',
  },
  {
    background: 'linear-gradient(145deg, #FFF0E8 0%, #FFE0D2 100%)',
    foreground: '#71351F',
    accent: '#E66D3F',
  },
  {
    background: 'linear-gradient(145deg, #E7F7F1 0%, #D0EFE4 100%)',
    foreground: '#174D40',
    accent: '#229574',
  },
  {
    background: 'linear-gradient(145deg, #F1ECFF 0%, #E2D7FF 100%)',
    foreground: '#493579',
    accent: '#795AC8',
  },
  {
    background: 'linear-gradient(145deg, #FFF8DD 0%, #FBEAB5 100%)',
    foreground: '#66501B',
    accent: '#C38A16',
  },
  {
    background: 'linear-gradient(145deg, #E7F7FA 0%, #CDEDF2 100%)',
    foreground: '#174A57',
    accent: '#248CA4',
  },
  {
    background: 'linear-gradient(145deg, #FCECF3 0%, #F7D8E5 100%)',
    foreground: '#71314E',
    accent: '#C55887',
  },
];

function categoryIcon(name: string): RemixiconComponentType {
  const normalized = name.toLocaleLowerCase();
  if (normalized.includes('ใบงาน') || normalized.includes('worksheet')) return RiDraftLine;
  if (normalized.includes('ทดสอบ') || normalized.includes('quiz')) return RiQuestionnaireLine;
  if (normalized.includes('แผน') || normalized.includes('lesson')) return RiCalendarTodoLine;
  if (normalized.includes('คอร์ส') || normalized.includes('course')) return RiPresentationLine;
  if (normalized.includes('ประกอบ') || normalized.includes('material')) return RiPaletteLine;
  return RiBookOpenLine;
}

type PublicStats = {
  teachers: number;
  products: number;
  schools: number;
  externalMembers: number;
  activeSellers: number;
  completedOrders: number;
};

type LandingReview = {
  id: string;
  rating: number;
  comment: string;
  reviewerName: string;
  updatedAt: string;
  product: {
    id: string;
    title: string;
    titleEn: string | null;
  };
};

const trustMetrics: Array<{ key: keyof PublicStats; labelKey: string }> = [
  { key: 'teachers', labelKey: 'teachers' },
  { key: 'externalMembers', labelKey: 'members' },
  { key: 'products', labelKey: 'products' },
  { key: 'schools', labelKey: 'schools' },
];

const benefits = [
  {
    key: 'fastSearch',
    icon: RiSearchLine,
    color: '#1565F5',
    background: '#E9F2FF',
  },
  {
    key: 'earnIncome',
    icon: RiMoneyDollarCircleLine,
    color: '#16A36A',
    background: '#E8F8EF',
  },
  {
    key: 'reviewedQuality',
    icon: RiStarLine,
    color: '#F59E0B',
    background: '#FFF5D9',
  },
  {
    key: 'secure',
    icon: RiLockLine,
    color: '#8B5CF6',
    background: '#F2EDFF',
  },
];

const buyerSteps = [
  {
    key: 'signUp',
    icon: RiUserAddLine,
  },
  {
    key: 'findResources',
    icon: RiSearchLine,
  },
  {
    key: 'buyDownload',
    icon: RiDownloadLine,
  },
  {
    key: 'useResource',
    icon: RiBookReadLine,
  },
];

const sellerSteps = [
  {
    key: 'openStore',
    icon: RiStore2Line,
  },
  {
    key: 'uploadResource',
    icon: RiUploadCloudLine,
  },
  {
    key: 'submitReview',
    icon: RiTimeLine,
  },
  {
    key: 'startEarning',
    icon: RiWallet3Line,
  },
];

const audiences = [
  {
    key: 'teachers',
    icon: RiUserStarLine,
  },
  {
    key: 'schools',
    icon: RiSchoolLine,
  },
  {
    key: 'students',
    icon: RiGraduationCapLine,
  },
  {
    key: 'tutors',
    icon: RiBookOpenLine,
  },
];

const communityIdeas = [
  { key: 'worksheet', icon: RiBookOpenLine, color: '#1565F5', background: '#EAF2FF' },
  { key: 'reviewGame', icon: RiGraduationCapLine, color: '#E86A33', background: '#FFF0E8' },
  { key: 'lessonSlides', icon: RiFileList3Line, color: '#7A5AF8', background: '#F2EEFF' },
  { key: 'miniQuiz', icon: RiShieldCheckLine, color: '#18A46F', background: '#E9F8F1' },
] as const;

const faqKeys = ['freeStore', 'fees', 'payout', 'eligibleSellers', 'fileTypes'] as const;

function LandingBannerSlide({ banner }: { banner: MarketplaceLandingBanner }) {
  const image = (
    <Box sx={{ position: 'relative', width: 1, height: 1, minHeight: { xs: 720, sm: 620 } }}>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: banner.mobile_image_url ? { xs: 'none', sm: 'block' } : 'block',
        }}
      >
        <Image
          fill
          priority={banner.sort_order === 0}
          src={banner.desktop_image_url}
          alt={banner.alt_text || banner.title}
          sizes="100vw"
          style={{ objectFit: 'cover' }}
        />
      </Box>
      {!!banner.mobile_image_url && (
        <Box sx={{ position: 'absolute', inset: 0, display: { xs: 'block', sm: 'none' } }}>
          <Image
            fill
            src={banner.mobile_image_url}
            alt={banner.alt_text || banner.title}
            sizes="100vw"
            style={{ objectFit: 'cover' }}
          />
        </Box>
      )}
    </Box>
  );

  if (!banner.link_url) return image;

  const isInternal = banner.link_url.startsWith('/');
  return (
    <Box
      component="a"
      href={banner.link_url}
      target={isInternal ? undefined : '_blank'}
      rel={isInternal ? undefined : 'noopener noreferrer'}
      aria-label={banner.title}
      sx={{ display: 'block', width: 1, height: 1 }}
    >
      {image}
    </Box>
  );
}

export function MarketplaceLandingView() {
  const theme = useTheme();
  const { t, currentLang } = useTranslate('marketplace');
  const formatCount = (value: number) =>
    new Intl.NumberFormat(currentLang.numberFormat.code).format(value);
  const [publicStats, setPublicStats] = useState<PublicStats | null>(null);
  const [officialProducts, setOfficialProducts] = useState<MarketplaceProduct[]>([]);
  const [officialProductsLoading, setOfficialProductsLoading] = useState(true);
  const [bestSellingProducts, setBestSellingProducts] = useState<MarketplaceProduct[]>([]);
  const [bestSellingProductsLoading, setBestSellingProductsLoading] = useState(true);
  const [landingBanners, setLandingBanners] = useState<MarketplaceLandingBanner[]>([]);
  const [communityReviews, setCommunityReviews] = useState<LandingReview[]>([]);
  const [landingCategories, setLandingCategories] = useState<LandingCategory[]>(fallbackCategories);
  const autoplayPlugin = useMemo(
    () => Autoplay({ delay: 6000, stopOnInteraction: false, stopOnMouseEnter: true }),
    []
  );
  const heroCarousel = useCarousel({ loop: landingBanners.length > 0, align: 'start' }, [
    autoplayPlugin,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/marketplace/public-stats', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(t('errors.stats'));
        return response.json() as Promise<PublicStats>;
      })
      .then(setPublicStats)
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setPublicStats(null);
      });

    return () => controller.abort();
  }, [t]);

  useEffect(() => {
    getProducts({ official: true, page: 1, limit: 4 })
      .then(({ products }) => setOfficialProducts(products))
      .catch(() => setOfficialProducts([]))
      .finally(() => setOfficialProductsLoading(false));
  }, []);

  useEffect(() => {
    getProducts({ bestSeller: true, page: 1, limit: 4 })
      .then(({ products }) => setBestSellingProducts(products))
      .catch(() => setBestSellingProducts([]))
      .finally(() => setBestSellingProductsLoading(false));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/marketplace/landing-banners', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return { items: [] };
        return response.json() as Promise<{ items?: MarketplaceLandingBanner[] }>;
      })
      .then((result) => setLandingBanners(result.items ?? []))
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') setLandingBanners([]);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/marketplace/landing-reviews', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return { items: [] };
        return response.json() as Promise<{ items?: LandingReview[] }>;
      })
      .then((result) => setCommunityReviews(result.items ?? []))
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') setCommunityReviews([]);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/marketplace/landing-categories', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return { items: [] };
        return response.json() as Promise<{ items?: LandingCategory[] }>;
      })
      .then((result) => {
        if (result.items?.length) setLandingCategories(result.items);
      })
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') setLandingCategories(fallbackCategories);
      });
    return () => controller.abort();
  }, []);

  return (
    <>
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <Carousel
          carousel={heroCarousel}
          slotProps={{
            container: { alignItems: 'stretch' },
            slide: { minWidth: '100%', alignSelf: 'stretch' },
          }}
        >
          <Box
            key="marketplace-hero"
            sx={{
              py: { xs: 8, md: 14 },
              height: 1,
              minHeight: { sm: 620 },
              background:
                'radial-gradient(circle at 82% 18%, rgba(21,101,245,0.18), transparent 32%), radial-gradient(circle at 15% 82%, rgba(24,185,160,0.12), transparent 30%), linear-gradient(180deg, #F5F9FF 0%, #FFFFFF 100%)',
            }}
          >
            <Container maxWidth="lg">
              <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
                <Grid size={{ xs: 12, md: 7 }}>
                  <Stack spacing={3.5} alignItems={{ xs: 'center', md: 'flex-start' }}>
                    <Chip
                      color="primary"
                      variant="soft"
                      icon={<RiGraduationCapLine />}
                      label={t('hero.eyebrow')}
                      sx={{
                        px: 0.5,
                        borderRadius: 3,
                        boxShadow: '0 6px 18px rgba(21,101,245,0.08)',
                      }}
                    />
                    <Typography
                      component="h1"
                      variant="h1"
                      sx={{
                        maxWidth: 760,
                        fontSize: { xs: 42, sm: 54, md: 72 },
                        lineHeight: 1.08,
                        textAlign: { xs: 'center', md: 'left' },
                      }}
                    >
                      {t('hero.title')}
                      <Box
                        component="span"
                        sx={{
                          mt: 2,
                          display: 'block',
                          color: 'primary.main',
                          position: 'relative',
                          width: 'fit-content',
                          mx: { xs: 'auto', md: 0 },
                          '&::after': {
                            left: '8%',
                            right: '-2%',
                            bottom: 2,
                            height: 8,
                            zIndex: -1,
                            content: '""',
                            opacity: 0.45,
                            position: 'absolute',
                            borderRadius: '50%',
                            bgcolor: '#BFD7FF',
                            transform: 'rotate(-1deg)',
                          },
                        }}
                      >
                        {t('hero.highlight')}
                      </Box>
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{
                        maxWidth: 680,
                        fontWeight: 400,
                        color: 'text.secondary',
                        lineHeight: 1.8,
                        textAlign: { xs: 'center', md: 'left' },
                      }}
                    >
                      {t('hero.description')}
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                      <Button
                        size="large"
                        variant="contained"
                        component={RouterLink}
                        href={paths.marketplace.products}
                        startIcon={<RiShoppingBag3Line />}
                        sx={{ borderRadius: 2.5, px: 2.5 }}
                      >
                        {t('actions.browse')}
                      </Button>
                      <Button
                        size="large"
                        variant="outlined"
                        component={RouterLink}
                        href={paths.marketplace.seller}
                        startIcon={<RiStore2Line />}
                        sx={{ borderRadius: 2.5, px: 2.5, bgcolor: 'rgba(255,255,255,0.72)' }}
                      >
                        {t('actions.startSelling')}
                      </Button>
                    </Stack>
                  </Stack>
                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>
                  <Card
                    sx={{
                      p: { xs: 3, md: 4 },
                      overflow: 'hidden',
                      position: 'relative',
                      borderRadius: '36px 36px 36px 14px',
                      color: 'common.white',
                      background: 'linear-gradient(145deg, #174AA5 0%, #2877F3 100%)',
                      boxShadow: '0 28px 70px rgba(30,84,173,0.22)',
                      '&::before': {
                        right: -72,
                        bottom: -82,
                        width: 210,
                        height: 210,
                        content: '""',
                        opacity: 0.14,
                        position: 'absolute',
                        borderRadius: '50%',
                        border: '38px solid white',
                      },
                    }}
                  >
                    <Stack spacing={3} sx={{ zIndex: 1, position: 'relative' }}>
                      <Box
                        sx={{
                          width: 58,
                          height: 58,
                          display: 'grid',
                          borderRadius: '20px 20px 8px 20px',
                          placeItems: 'center',
                          bgcolor: 'rgba(255,255,255,0.14)',
                          border: '1px solid rgba(255,255,255,0.2)',
                        }}
                      >
                        <RiShieldCheckLine size={34} />
                      </Box>
                      <Chip
                        size="small"
                        icon={<RiUserStarLine />}
                        label={t('hero.trustBadge')}
                        sx={{
                          width: 'fit-content',
                          color: 'common.white',
                          bgcolor: 'rgba(255,255,255,0.13)',
                          '& .MuiChip-icon': { color: 'inherit' },
                        }}
                      />
                      <Typography variant="h3">{t('hero.trustTitle')}</Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.8 }}>
                        {t('hero.trustDescription')}
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6 }}>
                          {publicStats ? (
                            <Typography variant="h4">
                              {formatCount(publicStats.activeSellers)}
                            </Typography>
                          ) : (
                            <Skeleton
                              width={72}
                              height={40}
                              sx={{ bgcolor: 'rgba(255,255,255,0.14)' }}
                            />
                          )}
                          <Typography variant="caption">{t('stats.approvedStores')}</Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          {publicStats ? (
                            <Typography variant="h4">
                              {formatCount(publicStats.completedOrders)}
                            </Typography>
                          ) : (
                            <Skeleton
                              width={72}
                              height={40}
                              sx={{ bgcolor: 'rgba(255,255,255,0.14)' }}
                            />
                          )}
                          <Typography variant="caption">{t('stats.completedOrders')}</Typography>
                        </Grid>
                      </Grid>
                    </Stack>
                  </Card>
                </Grid>
              </Grid>
            </Container>
          </Box>

          {landingBanners.map((banner) => (
            <LandingBannerSlide key={banner.id} banner={banner} />
          ))}
        </Carousel>

        {!!landingBanners.length && (
          <>
            <CarouselArrowFloatButtons
              {...heroCarousel.arrows}
              options={heroCarousel.options}
              sx={{ display: { xs: 'none', md: 'inline-flex' }, opacity: 0.78 }}
              slotProps={{
                prevBtn: { sx: { left: 32, transform: 'translateY(-50%)' } },
                nextBtn: { sx: { right: 32, transform: 'translateY(-50%)' } },
              }}
            />
            <CarouselDotButtons
              {...heroCarousel.dots}
              variant="rounded"
              aria-label="เลือกสไลด์หน้าหลัก"
              sx={{
                position: 'absolute',
                left: '50%',
                bottom: 18,
                transform: 'translateX(-50%)',
                px: 1,
                color: 'primary.main',
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.86)',
                boxShadow: '0 4px 18px rgba(15, 23, 42, 0.12)',
              }}
            />
          </>
        )}
      </Box>

      <Box
        sx={{
          py: { xs: 5, md: 6 },
          color: 'common.white',
          background: 'linear-gradient(110deg, #123E8C 0%, #185BB8 100%)',
        }}
      >
        <Container maxWidth="xl">
          <Typography
            variant="overline"
            sx={{ display: 'block', mb: 2.5, textAlign: 'center', color: 'primary.lighter' }}
          >
            {t('stats.eyebrow')}
          </Typography>
          <Grid container>
            {trustMetrics.map((metric, index) => (
              <Grid key={metric.key} size={{ xs: 6, md: 3 }}>
                <Box
                  sx={{
                    py: { xs: 2, sm: 1 },
                    textAlign: 'center',
                    borderRight: {
                      xs: index % 2 === 0 ? '1px solid' : 0,
                      md: index < trustMetrics.length - 1 ? '1px solid' : 0,
                    },
                    borderBottom: {
                      xs: index < 2 ? '1px solid' : 0,
                      md: 0,
                    },
                    borderColor: 'rgba(255,255,255,0.18)',
                  }}
                >
                  {publicStats ? (
                    <Typography variant="h2" sx={{ color: 'common.white' }}>
                      {formatCount(publicStats[metric.key] ?? 0)}
                    </Typography>
                  ) : (
                    <Skeleton
                      width={120}
                      height={58}
                      animation="wave"
                      sx={{ mx: 'auto', bgcolor: 'rgba(255,255,255,0.14)' }}
                    />
                  )}
                  <Typography sx={{ mt: 0.5, color: 'rgba(255,255,255,0.72)' }}>
                    {t(`stats.${metric.labelKey}`)}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {(officialProductsLoading || officialProducts.length > 0) && (
        <Box sx={{ py: { xs: 7, md: 10 }, bgcolor: 'background.neutral' }}>
          <Container maxWidth="lg">
            <Stack spacing={4.5}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
                justifyContent="space-between"
              >
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <RiShieldStarFill size={25} color={theme.palette.primary.main} aria-hidden />
                    <Typography variant="overline" color={theme.palette.primary.main}>
                      OFFICIAL E-KRU PRODUCTS
                    </Typography>
                  </Stack>
                  <Typography variant="h3" sx={{ mt: 0.75 }}>
                    {t('official.title')}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1.25 }}>
                    {t('official.description')}
                  </Typography>
                </Box>
                <Button
                  component={RouterLink}
                  href={paths.marketplace.officialProducts}
                  endIcon={<RiArrowRightLine />}
                  sx={{ flexShrink: 0 }}
                >
                  {t('actions.viewAll')}
                </Button>
              </Stack>

              <Grid container spacing={2.5}>
                {officialProductsLoading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <Grid key={index} size={{ xs: 12, sm: 6, md: 3 }}>
                        <Card variant="outlined" sx={{ p: 1.5, borderRadius: 2.5 }}>
                          <Skeleton variant="rounded" sx={{ aspectRatio: '4 / 3' }} />
                          <Skeleton width="55%" sx={{ mt: 2 }} />
                          <Skeleton height={28} />
                          <Skeleton width="75%" />
                          <Skeleton variant="rounded" height={44} sx={{ mt: 2 }} />
                        </Card>
                      </Grid>
                    ))
                  : officialProducts.map((product, index) => (
                      <Grid key={product.id} size={{ xs: 12, sm: 6, md: 3 }}>
                        <MarketplaceProductCard product={product} colorIndex={index} />
                      </Grid>
                    ))}
              </Grid>
            </Stack>
          </Container>
        </Box>
      )}

      {(bestSellingProductsLoading || bestSellingProducts.length > 0) && (
        <Box sx={{ py: { xs: 7, md: 10 } }}>
          <Container maxWidth="lg">
            <Stack spacing={4.5}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
                justifyContent="space-between"
              >
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <RiFireFill size={25} color="#F97316" aria-hidden />
                    <Typography variant="overline" sx={{ color: '#EA580C' }}>
                      BEST SELLERS
                    </Typography>
                  </Stack>
                  <Typography variant="h3" sx={{ mt: 0.75 }}>
                    {t('bestSellers.title')}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1.25 }}>
                    {t('bestSellers.description')}
                  </Typography>
                </Box>
                <Button
                  component={RouterLink}
                  href={paths.marketplace.products}
                  endIcon={<RiArrowRightLine />}
                  sx={{ flexShrink: 0 }}
                >
                  {t('actions.viewMore')}
                </Button>
              </Stack>

              <Grid container spacing={2.5}>
                {bestSellingProductsLoading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <Grid key={index} size={{ xs: 12, sm: 6, md: 3 }}>
                        <Card variant="outlined" sx={{ p: 1.5, borderRadius: 2.5 }}>
                          <Skeleton variant="rounded" sx={{ aspectRatio: '4 / 3' }} />
                          <Skeleton width="55%" sx={{ mt: 2 }} />
                          <Skeleton height={28} />
                          <Skeleton width="75%" />
                          <Skeleton variant="rounded" height={44} sx={{ mt: 2 }} />
                        </Card>
                      </Grid>
                    ))
                  : bestSellingProducts.map((product, index) => (
                      <Grid key={product.id} size={{ xs: 12, sm: 6, md: 3 }}>
                        <Box sx={{ height: 1, position: 'relative' }}>
                          {/* <Chip
                            size="small"
                            color="warning"
                            icon={<RiFireFill />}
                            label={`อันดับ ${index + 1} · ขายแล้ว ${formatCount(
                              product.engagement?.purchases ?? 0
                            )}`}
                            sx={{
                              top: 24,
                              right: 24,
                              zIndex: 2,
                              position: 'absolute',
                              fontWeight: 700,
                            }}
                          /> */}
                          <MarketplaceProductCard product={product} colorIndex={index + 1} />
                        </Box>
                      </Grid>
                    ))}
              </Grid>
            </Stack>
          </Container>
        </Box>
      )}

      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
        <Stack spacing={4.5}>
          <SectionHeading
            eyebrow="E-KRU MARKETPLACE"
            title={t('benefits.heading')}
            description={t('benefits.description')}
          />
          <Grid container spacing={2.5}>
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <Grid key={benefit.key} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      p: 3,
                      height: 1,
                      borderRadius: 3,
                      transition: 'transform 160ms ease, box-shadow 160ms ease',
                      '&:hover': { transform: 'translateY(-4px)', boxShadow: 8 },
                    }}
                  >
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        display: 'grid',
                        borderRadius: 2.25,
                        placeItems: 'center',
                        color: benefit.color,
                        bgcolor: benefit.background,
                      }}
                    >
                      <Icon size={30} />
                    </Box>
                    <Typography variant="h6" sx={{ mt: 2.5 }}>
                      {t(`benefits.items.${benefit.key}.title`)}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1, lineHeight: 1.75 }}
                    >
                      {t(`benefits.items.${benefit.key}.description`)}
                    </Typography>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Stack>
      </Container>

      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
        <Stack spacing={4}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3">{t('categories.heading')}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {t('categories.description')}
            </Typography>
          </Box>
          <Box
            sx={{
              gap: 2.25,
              display: 'grid',
              gridAutoRows: { md: 236 },
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: `repeat(${landingCategories.length >= 7 ? 4 : Math.min(3, landingCategories.length)}, minmax(0, 1fr))`,
              },
            }}
          >
            {landingCategories.map((category, index) => {
              const Icon = categoryIcon(category.name);
              const palette = categoryPalettes[index % categoryPalettes.length];
              const fallbackCategory = fallbackCategories.find(
                (item) => item.name === category.name
              );
              const translationKey = category.translationKey ?? fallbackCategory?.translationKey;
              const title = translationKey
                ? t(`categories.items.${translationKey}`)
                : category.name;
              const description = translationKey
                ? t(`categories.itemDescriptions.${translationKey}`)
                : category.description || t('categories.cardFallback');
              const isFeatureCard = index === 0 && landingCategories.length >= 3;
              const shouldSpanLast =
                landingCategories.length === 6 && index === landingCategories.length - 1;

              return (
                <Card
                  key={category.id}
                  component={RouterLink}
                  href={`${paths.marketplace.products}?category=${encodeURIComponent(category.name)}`}
                  sx={{
                    p: { xs: 2.5, md: 2.75 },
                    minHeight: { xs: isFeatureCard ? 310 : 240, sm: 260, md: 0 },
                    color: palette.foreground,
                    display: 'flex',
                    overflow: 'hidden',
                    position: 'relative',
                    borderRadius: 3.5,
                    border: '1px solid rgba(255,255,255,0.88)',
                    textDecoration: 'none',
                    flexDirection: 'column',
                    background: palette.background,
                    gridRow: { md: isFeatureCard ? 'span 2' : 'span 1' },
                    gridColumn: { md: shouldSpanLast ? 'span 2' : 'span 1' },
                    boxShadow: '0 12px 30px rgba(51, 76, 110, 0.09)',
                    transition: 'transform 180ms ease, box-shadow 180ms ease',
                    '&::before': {
                      top: -48,
                      right: -35,
                      width: 170,
                      height: 170,
                      content: '""',
                      opacity: 0.42,
                      position: 'absolute',
                      borderRadius: '50%',
                      border: `34px solid ${palette.accent}18`,
                    },
                    '&::after': {
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: '38%',
                      content: '""',
                      zIndex: 1,
                      position: 'absolute',
                      background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.44))',
                    },
                    '&:hover': {
                      transform: 'translateY(-5px)',
                      boxShadow: `0 20px 42px ${palette.accent}2A`,
                      '& .category-arrow': { transform: 'translateX(3px)' },
                      '& .category-cover': { transform: 'translateY(-4px) rotate(0deg)' },
                      '& .category-icon': { transform: 'rotate(-6deg) scale(1.06)' },
                    },
                    '&:focus-visible': {
                      outline: '3px solid',
                      outlineColor: 'primary.light',
                      outlineOffset: 3,
                    },
                  }}
                >
                  <Box
                    className="category-icon"
                    sx={{
                      top: 18,
                      right: 18,
                      zIndex: 2,
                      width: isFeatureCard ? 58 : 50,
                      height: isFeatureCard ? 58 : 50,
                      display: 'grid',
                      color: palette.accent,
                      position: 'absolute',
                      borderRadius: '18px 18px 8px 18px',
                      placeItems: 'center',
                      border: `1px solid ${palette.accent}20`,
                      backgroundColor: 'rgba(255,255,255,0.70)',
                      boxShadow: '0 8px 18px rgba(47, 72, 103, 0.08)',
                      transition: 'transform 180ms ease',
                    }}
                  >
                    <Icon size={isFeatureCard ? 29 : 25} />
                  </Box>

                  <Box sx={{ zIndex: 2, position: 'relative', maxWidth: '76%' }}>
                    <Typography variant={isFeatureCard ? 'h4' : 'h5'} sx={{ color: 'inherit' }}>
                      {title}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.75, opacity: 0.92, lineHeight: 1.55 }}>
                      {description}
                    </Typography>
                  </Box>

                  {category.previewImages.length > 0 && (
                    <Box
                      sx={{
                        right: { xs: 58, md: 55 },
                        bottom: -12,
                        zIndex: 1,
                        width: isFeatureCard ? '78%' : '62%',
                        height: isFeatureCard ? '58%' : '53%',
                        position: 'absolute',
                      }}
                    >
                      {category.previewImages.slice(0, 3).map((imageUrl, imageIndex) => (
                        <Box
                          key={imageUrl}
                          className="category-cover"
                          sx={{
                            top: imageIndex * 9,
                            right: imageIndex * 28,
                            width: '64%',
                            height: '100%',
                            overflow: 'hidden',
                            position: 'absolute',
                            borderRadius: '14px 14px 0 0',
                            border: '3px solid rgba(255,255,255,0.9)',
                            boxShadow: '0 12px 24px rgba(41,63,91,0.16)',
                            transform: `rotate(${(imageIndex - 1) * 5}deg)`,
                            transformOrigin: 'bottom center',
                            transition: 'transform 180ms ease',
                          }}
                        >
                          <Box
                            component="img"
                            alt=""
                            src={imageUrl}
                            sx={{ width: 1, height: 1, display: 'block', objectFit: 'cover' }}
                          />
                        </Box>
                      ))}
                    </Box>
                  )}

                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mt: 'auto', zIndex: 3, position: 'relative' }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{
                        px: 1.25,
                        py: 0.55,
                        borderRadius: 5,
                        color: 'inherit',
                        backdropFilter: 'blur(5px)',
                        bgcolor: 'rgba(255,255,255,0.64)',
                        border: '1px solid rgba(255,255,255,0.8)',
                      }}
                    >
                      {t('categories.itemCount', { count: category.count })}
                    </Typography>
                    <Box
                      className="category-arrow"
                      sx={{
                        width: 38,
                        height: 38,
                        display: 'grid',
                        color: palette.accent,
                        borderRadius: '14px 14px 7px 14px',
                        placeItems: 'center',
                        border: `1px solid ${palette.accent}18`,
                        bgcolor: 'rgba(255,255,255,0.82)',
                        transition: 'transform 180ms ease',
                      }}
                    >
                      <RiArrowRightLine size={20} />
                    </Box>
                  </Stack>
                </Card>
              );
            })}
          </Box>
        </Stack>
      </Container>

      <Box
        sx={{
          py: { xs: 8, md: 12 },
          position: 'relative',
          overflow: 'hidden',
          background:
            'radial-gradient(circle at 8% 15%, rgba(21,101,245,0.12), transparent 25%), radial-gradient(circle at 92% 82%, rgba(22,163,106,0.12), transparent 25%), linear-gradient(180deg, #F8FBFF 0%, #F3F8FF 100%)',
          '&::before': {
            top: 54,
            left: '6%',
            width: 84,
            height: 84,
            content: '""',
            opacity: 0.35,
            position: 'absolute',
            borderRadius: '50%',
            border: '1px dashed',
            borderColor: 'primary.light',
          },
          '&::after': {
            right: '7%',
            bottom: 46,
            width: 118,
            height: 118,
            content: '""',
            opacity: 0.25,
            position: 'absolute',
            borderRadius: 5,
            border: '1px dashed',
            borderColor: 'success.light',
            transform: 'rotate(12deg)',
          },
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Stack spacing={{ xs: 4, md: 6 }}>
            <SectionHeading
              eyebrow="HOW IT WORKS"
              title={t('process.heading')}
              description={t('process.description')}
            />
            <Grid container spacing={{ xs: 2.5, md: 3.5 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <ProcessCard
                  eyebrow="I WANT TO LEARN"
                  title={t('process.buyer.title')}
                  description={t('process.buyer.description')}
                  steps={buyerSteps.map((step) => ({
                    ...step,
                    label: t(`process.buyer.steps.${step.key}.label`),
                    description: t(`process.buyer.steps.${step.key}.description`),
                  }))}
                  color="primary"
                  actionLabel={t('actions.browse')}
                  actionHref={paths.marketplace.products}
                  headerIcon={RiShoppingBag3Line}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <ProcessCard
                  eyebrow="I WANT TO SELL"
                  title={t('process.seller.title')}
                  description={t('process.seller.description')}
                  steps={sellerSteps.map((step) => ({
                    ...step,
                    label: t(`process.seller.steps.${step.key}.label`),
                    description: t(`process.seller.steps.${step.key}.description`),
                  }))}
                  color="success"
                  actionLabel={t('actions.applySeller')}
                  actionHref={paths.marketplace.sellerSetup}
                  headerIcon={RiStore2Line}
                />
              </Grid>
            </Grid>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
        <Stack spacing={4.5}>
          <SectionHeading
            eyebrow="FOR EVERY LEARNER"
            title={t('audiences.heading')}
            description={t('audiences.description')}
          />
          <Grid container spacing={2.5}>
            {audiences.map((audience) => {
              const Icon = audience.icon;
              return (
                <Grid key={audience.key} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      p: 3,
                      height: 1,
                      borderRadius: 3,
                      textAlign: 'center',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        mx: 'auto',
                        display: 'grid',
                        borderRadius: '50%',
                        placeItems: 'center',
                        color: 'primary.main',
                        bgcolor: 'primary.lighter',
                      }}
                    >
                      <Icon size={32} />
                    </Box>
                    <Typography variant="h5" sx={{ mt: 2.5 }}>
                      {t(`audiences.items.${audience.key}.title`)}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1, lineHeight: 1.7 }}
                    >
                      {t(`audiences.items.${audience.key}.description`)}
                    </Typography>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          <Box
            sx={{
              mt: { xs: 4, md: 7 },
              p: { xs: 3, sm: 4, md: 6 },
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 4,
              border: '1px solid #F0DEC7',
              background:
                'radial-gradient(circle at 8% 8%, rgba(255,184,107,0.25), transparent 30%), radial-gradient(circle at 92% 92%, rgba(21,101,245,0.14), transparent 31%), linear-gradient(135deg, #FFF9EF 0%, #FFFFFF 56%, #F4F8FF 100%)',
            }}
          >
            <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
              <Grid size={{ xs: 12, md: 6 }}>
                <Chip
                  label={t('community.eyebrow')}
                  sx={{
                    color: '#9A5B16',
                    fontWeight: 800,
                    bgcolor: '#FFF0D5',
                    border: '1px solid #F5D49D',
                  }}
                />
                <Typography component="h2" variant="h3" sx={{ mt: 2.5, maxWidth: 590 }}>
                  {t('community.heading')}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 610, lineHeight: 1.85 }}>
                  {t('community.description')}
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3.5 }}>
                  <Button
                    component={RouterLink}
                    href={paths.marketplace.sellerSetup}
                    size="large"
                    variant="contained"
                    endIcon={<RiArrowRightLine />}
                  >
                    {t('community.actions.sell')}
                  </Button>
                  <Button
                    component={RouterLink}
                    href={paths.marketplace.products}
                    size="large"
                    color="inherit"
                  >
                    {t('community.actions.explore')}
                  </Button>
                </Stack>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 2, display: 'block' }}
                >
                  {t('community.helper')}
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Card
                  sx={{
                    p: { xs: 2.5, sm: 3.5 },
                    borderRadius: 3.5,
                    border: '1px solid #E5EAF2',
                    boxShadow: '0 22px 50px rgba(44, 62, 93, 0.10)',
                    transform: { md: 'rotate(1deg)' },
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
                    spacing={2}
                  >
                    <Box>
                      <Typography variant="overline" color="primary.main" sx={{ fontWeight: 800 }}>
                        {t('community.card.eyebrow')}
                      </Typography>
                      <Typography variant="h5" sx={{ mt: 0.5 }}>
                        {t('community.card.title')}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        px: 1.5,
                        py: 1,
                        height: 'fit-content',
                        flexShrink: 0,
                        borderRadius: 2,
                        color: '#9A5B16',
                        bgcolor: '#FFF0D5',
                        typography: 'subtitle1',
                        fontWeight: 800,
                      }}
                    >
                      ฿30–40
                    </Box>
                  </Stack>

                  <Grid container spacing={1.5} sx={{ mt: 2 }}>
                    {communityIdeas.map((idea) => {
                      const Icon = idea.icon;
                      return (
                        <Grid key={idea.key} size={{ xs: 12, sm: 6 }}>
                          <Stack
                            direction="row"
                            spacing={1.25}
                            alignItems="center"
                            sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.neutral' }}
                          >
                            <Box
                              sx={{
                                width: 38,
                                height: 38,
                                display: 'grid',
                                flexShrink: 0,
                                borderRadius: 1.5,
                                placeItems: 'center',
                                color: idea.color,
                                bgcolor: idea.background,
                              }}
                            >
                              <Icon size={21} />
                            </Box>
                            <Typography variant="subtitle2">
                              {t(`community.ideas.${idea.key}`)}
                            </Typography>
                          </Stack>
                        </Grid>
                      );
                    })}
                  </Grid>

                  <Box
                    sx={{
                      mt: 2.5,
                      p: 2,
                      borderRadius: 2,
                      color: '#35624F',
                      bgcolor: '#EEF9F3',
                      border: '1px dashed #A8D9C2',
                    }}
                  >
                    <Typography variant="subtitle2">{t('community.card.noteTitle')}</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.82, lineHeight: 1.7 }}>
                      {t('community.card.noteDescription')}
                    </Typography>
                  </Box>
                </Card>
              </Grid>
            </Grid>
          </Box>

          {communityReviews.length >= 3 && (
            <Box sx={{ pt: { xs: 4, md: 7 } }}>
              <SectionHeading
                eyebrow="VOICES FROM THE CLASSROOM"
                title={t('reviews.heading')}
                description={t('reviews.description')}
              />
              <Grid container spacing={2.5} sx={{ mt: 4 }}>
                {communityReviews.slice(0, 3).map((review, index) => {
                  const productTitle =
                    currentLang.value === 'en' && review.product.titleEn
                      ? review.product.titleEn
                      : review.product.title;
                  const initials = review.reviewerName.slice(0, 1).toUpperCase();

                  return (
                    <Grid key={review.id} size={{ xs: 12, md: 4 }}>
                      <Card
                        variant="outlined"
                        sx={{
                          p: 3,
                          height: 1,
                          display: 'flex',
                          borderRadius: 3,
                          flexDirection: 'column',
                          borderColor: '#DCE5F1',
                          bgcolor: index === 1 ? '#FFFCF5' : 'background.paper',
                          transition: 'transform 160ms ease, box-shadow 160ms ease',
                          '&:hover': { transform: 'translateY(-4px)', boxShadow: 8 },
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Rating value={review.rating} precision={1} readOnly size="small" />
                          <Chip
                            size="small"
                            color="success"
                            variant="soft"
                            icon={<RiShieldCheckLine />}
                            label={t('reviews.verified')}
                          />
                        </Stack>

                        <Typography
                          sx={{
                            mt: 2.5,
                            flexGrow: 1,
                            lineHeight: 1.85,
                            color: 'text.secondary',
                            whiteSpace: 'pre-line',
                          }}
                        >
                          “{review.comment}”
                        </Typography>

                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mt: 3 }}>
                          <Avatar
                            sx={{
                              width: 42,
                              height: 42,
                              color: 'primary.main',
                              bgcolor: 'primary.lighter',
                              fontWeight: 800,
                            }}
                          >
                            {initials}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2">{review.reviewerName}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t('reviews.buyerLabel')}
                            </Typography>
                          </Box>
                        </Stack>

                        <Box
                          sx={{
                            mt: 2.5,
                            pt: 2,
                            borderTop: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {t('reviews.reviewing')}
                          </Typography>
                          <Typography variant="subtitle2" noWrap sx={{ mt: 0.25 }}>
                            {productTitle}
                          </Typography>
                          <Button
                            component={RouterLink}
                            href={paths.marketplace.product(review.product.id)}
                            size="small"
                            endIcon={<RiArrowRightLine />}
                            sx={{ mt: 1, px: 0 }}
                          >
                            {t('reviews.viewProduct')}
                          </Button>
                        </Box>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
              <Typography
                color="text.secondary"
                textAlign="center"
                sx={{ mt: 3, fontStyle: 'italic' }}
              >
                {t('reviews.closing')}
              </Typography>
            </Box>
          )}

          <Box sx={{ pt: { xs: 4, md: 6 }, pb: 2 }}>
            <SectionHeading
              eyebrow="FREQUENTLY ASKED QUESTIONS"
              title={t('faq.heading')}
              description={t('faq.description')}
            />
            <Stack spacing={1.5} sx={{ maxWidth: '100%', mx: 'auto', mt: 4, pb: 2 }}>
              {faqKeys.map((faqKey, index) => (
                <Accordion
                  key={faqKey}
                  disableGutters
                  defaultExpanded={index === 0}
                  elevation={0}
                  sx={{
                    px: { xs: 2, md: 2.5 },
                    overflow: 'hidden',
                    borderRadius: '12px !important',
                    border: '1px solid #DCE4EE !important',
                    borderBottom: '1px solid #D3DDE9 !important',
                    bgcolor: 'background.paper',
                    '&::before': { display: 'none' },
                    '&:last-of-type': {
                      borderBottomLeftRadius: '12px !important',
                      borderBottomRightRadius: '12px !important',
                    },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<RiArrowDownSLine size={22} />}
                    sx={{
                      px: 0,
                      minHeight: 64,
                      '& .MuiAccordionSummary-content': { my: 1.5 },
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          display: 'grid',
                          flexShrink: 0,
                          borderRadius: '50%',
                          placeItems: 'center',
                          color: 'primary.main',
                          bgcolor: 'primary.lighter',
                          typography: 'subtitle2',
                        }}
                      >
                        {index + 1}
                      </Box>
                      <Typography variant="subtitle1">
                        {t(`faq.items.${faqKey}.question`)}
                      </Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pt: 0, pb: 2.5 }}>
                    <Typography color="text.secondary" sx={{ pl: { sm: 6 }, lineHeight: 1.85 }}>
                      {t(`faq.items.${faqKey}.answer`)}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          </Box>

          <Card
            sx={{
              mt: 3,
              p: { xs: 3, md: 5 },
              borderRadius: 4,
              color: 'common.white',
              textAlign: 'center',
              background: 'linear-gradient(135deg, #0B3B91 0%, #1565F5 100%)',
            }}
          >
            <Typography variant="h3">{t('cta.title')}</Typography>
            <Typography sx={{ mt: 1.5, color: 'rgba(255,255,255,0.75)' }}>
              {t('cta.description')}
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              justifyContent="center"
              sx={{ mt: 3 }}
            >
              <Button
                size="large"
                variant="contained"
                color="white"
                component={RouterLink}
                href={paths.marketplace.products}
              >
                {t('actions.browse')}
              </Button>
              <Button
                size="large"
                variant="outlined"
                component={RouterLink}
                href={paths.marketplace.seller}
                sx={{ color: 'common.white', borderColor: 'rgba(255,255,255,0.45)' }}
              >
                {t('actions.applySeller')}
              </Button>
            </Stack>
          </Card>
        </Stack>
      </Container>
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="overline" color="primary.main">
        {eyebrow}
      </Typography>
      <Typography variant="h3" sx={{ mt: 0.5 }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 680, mx: 'auto', mt: 1.25 }}>
        {description}
      </Typography>
    </Box>
  );
}

function ProcessCard({
  eyebrow,
  title,
  description,
  steps,
  color,
  actionLabel,
  actionHref,
  headerIcon: HeaderIcon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  steps: Array<{ label: string; description: string; icon: RemixiconComponentType }>;
  color: 'primary' | 'success';
  actionLabel: string;
  actionHref: string;
  headerIcon: RemixiconComponentType;
}) {
  return (
    <Card
      sx={{
        p: { xs: 2.5, sm: 3, md: 4 },
        height: 1,
        borderRadius: 4,
        border: '1px solid',
        borderColor: `${color}.lighter`,
        boxShadow: '0 20px 60px rgba(17, 44, 94, 0.08)',
        transition: 'transform 200ms ease, box-shadow 200ms ease',
        '&:hover': {
          transform: 'translateY(-5px)',
          boxShadow: '0 26px 70px rgba(17, 44, 94, 0.14)',
        },
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 64,
            height: 64,
            display: 'grid',
            flexShrink: 0,
            borderRadius: 3,
            placeItems: 'center',
            color: `${color}.main`,
            background: (theme) =>
              `linear-gradient(145deg, ${theme.vars.palette[color].lighter}, ${theme.vars.palette.background.paper})`,
            boxShadow: (theme) => `inset 0 0 0 1px ${theme.vars.palette[color].lighter}`,
          }}
        >
          <HeaderIcon size={31} />
        </Box>
        <Box>
          <Typography
            variant="overline"
            sx={{ color: `${color}.main`, fontWeight: 800, letterSpacing: 1.1 }}
          >
            {eyebrow}
          </Typography>
          <Typography variant="h4">{title}</Typography>
        </Box>
      </Stack>
      <Typography color="text.secondary" sx={{ mt: 2, lineHeight: 1.75 }}>
        {description}
      </Typography>

      <Stack sx={{ mt: 3.5 }}>
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;
          return (
            <Stack key={step.label} direction="row" spacing={2} sx={{ position: 'relative' }}>
              <Stack alignItems="center" sx={{ width: 42, flexShrink: 0 }}>
                <Box
                  sx={{
                    zIndex: 1,
                    width: 42,
                    height: 42,
                    display: 'grid',
                    borderRadius: '50%',
                    placeItems: 'center',
                    color: 'common.white',
                    bgcolor: `${color}.main`,
                    boxShadow: (theme) => `0 0 0 6px ${theme.vars.palette[color].lighter}`,
                  }}
                >
                  <Typography variant="subtitle2">{String(index + 1).padStart(2, '0')}</Typography>
                </Box>
                {!isLast && (
                  <Box
                    sx={{
                      width: 2,
                      flex: 1,
                      minHeight: 34,
                      my: 0.75,
                      bgcolor: `${color}.lighter`,
                    }}
                  />
                )}
              </Stack>
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  pb: isLast ? 0 : 2.5,
                }}
              >
                <Box
                  sx={{
                    width: 46,
                    height: 46,
                    display: 'grid',
                    flexShrink: 0,
                    borderRadius: 2,
                    placeItems: 'center',
                    color: `${color}.main`,
                    bgcolor: `${color}.lighter`,
                  }}
                >
                  <Icon size={23} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1">{step.label}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    {step.description}
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          );
        })}
      </Stack>

      <Button
        fullWidth
        size="large"
        color={color}
        variant="soft"
        component={RouterLink}
        href={actionHref}
        endIcon={<RiArrowRightLine />}
        sx={{ mt: 3.5, py: 1.4 }}
      >
        {actionLabel}
      </Button>
    </Card>
  );
}
