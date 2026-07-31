'use client';

import type { RemixiconComponentType } from '@remixicon/react';
import type { MarketplaceProduct } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
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
  RiStarLine,
  RiFireFill,
  RiLockLine,
  RiTimeLine,
  RiSearchLine,
  RiSchoolLine,
  RiStore2Line,
  RiUserAddLine,
  RiWallet3Line,
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
  RiShoppingBag3Line,
  RiGraduationCapLine,
  RiMoneyDollarCircleLine,
} from 'src/components/remix-icon';

import { getProducts } from '../../shared/api';
import { MarketplaceProductCard } from '../../shared/product-card';

const categories = [
  { key: 'lessonPlans', value: 'แผนการสอน', icon: RiFileList3Line },
  { key: 'worksheets', value: 'ใบงาน', icon: RiBookOpenLine },
  { key: 'supplementary', value: 'สื่อประกอบ', icon: RiGraduationCapLine },
  { key: 'quizzes', value: 'แบบทดสอบ', icon: RiShieldCheckLine },
];

type PublicStats = {
  teachers: number;
  products: number;
  schools: number;
  externalMembers: number;
  activeSellers: number;
  completedOrders: number;
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

const faqKeys = ['freeStore', 'fees', 'payout', 'eligibleSellers', 'fileTypes'] as const;

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

  return (
    <>
      <Box
        sx={{
          py: { xs: 8, md: 14 },
          overflow: 'hidden',
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
                  label="E-KRU Marketplace"
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
                  <Box component="span" sx={{ display: 'block', color: 'primary.main', mt: 2 }}>
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
                  >
                    {t('actions.browse')}
                  </Button>
                  <Button
                    size="large"
                    variant="outlined"
                    component={RouterLink}
                    href={paths.marketplace.seller}
                    startIcon={<RiStore2Line />}
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
                  borderRadius: 5,
                  color: 'common.white',
                  background: 'linear-gradient(145deg, #0B3B91 0%, #1565F5 100%)',
                  boxShadow: '0 32px 80px rgba(13,63,156,0.28)',
                }}
              >
                <Stack spacing={3}>
                  <RiShieldCheckLine size={52} />
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

      <Box
        sx={{
          py: { xs: 5, md: 6 },
          color: 'common.white',
          bgcolor: 'primary.darker',
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
          <Grid container spacing={2.5}>
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <Grid key={category.key} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card
                    component={RouterLink}
                    href={`${paths.marketplace.products}?category=${encodeURIComponent(category.value)}`}
                    sx={{
                      p: 3,
                      height: 1,
                      display: 'block',
                      color: 'text.primary',
                      textAlign: 'center',
                      textDecoration: 'none',
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'transform 160ms ease, box-shadow 160ms ease',
                      '&:hover': { transform: 'translateY(-4px)', boxShadow: 8 },
                    }}
                  >
                    <Box sx={{ color: 'primary.main' }}>
                      <Icon size={38} />
                    </Box>
                    <Typography variant="h6" sx={{ mt: 1.5 }}>
                      {t(`categories.items.${category.key}`)}
                    </Typography>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
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
                    borderRadius: '12px !important',
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    '&::before': { display: 'none' },
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
                color="inherit"
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
