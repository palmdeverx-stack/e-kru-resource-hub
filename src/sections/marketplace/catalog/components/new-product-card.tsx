'use client';

import type { MarketplaceProduct } from '../../shared/types';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Rating from '@mui/material/Rating';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import {
  RiEyeLine,
  RiBookOpenLine,
  RiArrowRightUpLine,
  RiShoppingBag3Line,
} from 'src/components/remix-icon';

import { getMarketplacePricing } from '../../shared/pricing';
import { MarketplaceSellerLink } from '../../shared/seller-link';
import { formatPrice, getLocalizedProduct } from '../../shared/api';

const fallbackGradients = [
  'linear-gradient(135deg, #DDEBFF 0%, #F4F8FF 50%, #CFE3FF 100%)',
  'linear-gradient(135deg, #FFF0D9 0%, #FFF9EF 50%, #FFE0B2 100%)',
  'linear-gradient(135deg, #DDF7EB 0%, #F2FBF7 50%, #C5EEDC 100%)',
  'linear-gradient(135deg, #F0E5FF 0%, #FAF6FF 50%, #E2CEFF 100%)',
];

const categoryTranslationKeys: Record<string, string> = {
  'แผนการสอน': 'lessonPlans',
  'ใบงาน': 'worksheets',
  'สื่อประกอบ': 'supplementary',
  'แบบทดสอบ': 'quizzes',
  'คอร์สเรียน': 'courses',
};

export function MarketplaceNewProductCard({
  product,
  colorIndex = 0,
}: {
  product: MarketplaceProduct;
  colorIndex?: number;
}) {
  const { t, currentLang } = useTranslate('marketplace');
  const content = getLocalizedProduct(product, currentLang.value);
  const coverUrl =
    product.images?.find((image) => image.is_cover)?.url ??
    product.images?.[0]?.url ??
    product.cover_url ??
    undefined;
  const rating = product.engagement?.averageRating ?? 0;
  const reviewCount = product.engagement?.reviewCount ?? 0;
  const purchases = product.engagement?.purchases ?? 0;
  const views = product.engagement?.views ?? 0;
  const pricing = getMarketplacePricing(product);

  return (
    <Card
      sx={{
        p: 1.25,
        height: 1,
        display: 'flex',
        overflow: 'hidden',
        borderRadius: 2,
        color: 'text.primary',
        textDecoration: 'none',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 12px 36px rgba(15, 23, 42, 0.06)',
        transition: 'transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease',
        '&:hover': {
          transform: 'translateY(-7px)',
          borderColor: 'primary.light',
          boxShadow: '0 18px 36px rgba(21, 101, 245, 0.16)',
        },
      }}
    >
      <Box
        component={RouterLink}
        href={paths.marketplace.product(product.id)}
        aria-label={t('productCard.viewProduct', { title: content.title })}
        sx={{
          width: 1,
          minHeight: 230,
          position: 'relative',
          overflow: 'hidden',
          aspectRatio: '16 / 10',
          borderRadius: 1.2,
          display: 'grid',
          placeItems: 'center',
          textDecoration: 'none',
          background: fallbackGradients[colorIndex % fallbackGradients.length],
        }}
      >
        {coverUrl ? (
          <Box
            component="img"
            src={coverUrl}
            alt={content.title}
            sx={{
              width: 1,
              height: 1,
              objectFit: 'cover',
              transition: 'transform 400ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              '.MuiCard-root:hover &': { transform: 'scale(1.055)' },
            }}
          />
        ) : (
          <>
            <Box
              sx={{
                width: 116,
                height: 116,
                position: 'absolute',
                top: -30,
                right: -20,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.55)',
              }}
            />
            <Box
              sx={{
                width: 72,
                height: 72,
                position: 'absolute',
                bottom: -20,
                left: 20,
                borderRadius: 3,
                transform: 'rotate(18deg)',
                bgcolor: 'rgba(255,255,255,0.48)',
              }}
            />
            <RiBookOpenLine size={64} color="#1565F5" />
          </>
        )}

        <Box
          sx={{
            inset: 0,
            position: 'absolute',
            pointerEvents: 'none',
            background: 'linear-gradient(180deg, rgba(15,23,42,0.04) 45%, rgba(15,23,42,0.48))',
          }}
        />

        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          sx={{ inset: 14, bottom: 'auto', position: 'absolute' }}
        >
          <Chip
            size="small"
            label="NEW"
            sx={{
              color: 'common.white',
              fontWeight: 800,
              letterSpacing: 0.8,
              bgcolor: 'primary.main',
              boxShadow: '0 8px 18px rgba(21,101,245,0.28)',
            }}
          />
          {product.category && (
            <Chip
              size="small"
              label={
                categoryTranslationKeys[product.category]
                  ? t(`catalog.categoryLabels.${categoryTranslationKeys[product.category]}`)
                  : product.category
              }
              sx={{
                maxWidth: 150,
                fontWeight: 700,
                color: 'common.white',
                bgcolor: 'rgba(15,23,42,0.60)',
                backdropFilter: 'blur(8px)',
                '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
              }}
            />
          )}
        </Stack>

        <Stack
          direction="row"
          spacing={1.5}
          sx={{ left: 16, right: 16, bottom: 14, position: 'absolute', color: 'common.white' }}
        >
          <Stack direction="row" spacing={0.5} alignItems="center">
            <RiEyeLine size={16} />
            <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 600 }}>
              {views.toLocaleString(currentLang.numberFormat.code)}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <RiShoppingBag3Line size={16} />
            <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 600 }}>
              {purchases.toLocaleString(currentLang.numberFormat.code)}
            </Typography>
          </Stack>
        </Stack>
      </Box>

      <Stack spacing={1.5} sx={{ p: 1, pt: 2, flexGrow: 1 }}>
        <MarketplaceSellerLink
          seller={product.seller}
          avatarSize={30}
          nameVariant="caption"
          nameSx={{ color: 'text.secondary' }}
        />

        <Typography
          component={RouterLink}
          href={paths.marketplace.product(product.id)}
          variant="h6"
          sx={{
            color: 'text.primary',
            minHeight: 56,
            lineHeight: 1.4,
            textDecoration: 'none',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {content.title}
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center">
          <Rating value={rating} precision={0.1} readOnly size="small" />
          <Typography variant="caption" color="text.secondary">
            {reviewCount
              ? `${rating.toFixed(1)} (${reviewCount.toLocaleString(currentLang.numberFormat.code)})`
              : t('productCard.noReviews')}
          </Typography>
        </Stack>

        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ pt: 1.25, mt: 'auto !important', borderTop: '1px solid', borderColor: 'divider' }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t('productCard.price')}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h6" color="primary.main" sx={{ fontWeight: 800 }}>
                {formatPrice(pricing.salePrice, product.currency)}
              </Typography>
              {pricing.hasDiscount && (
                <>
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{ textDecoration: 'line-through' }}
                  >
                    {formatPrice(pricing.listPrice, product.currency)}
                  </Typography>
                  <Chip size="small" color="error" label={`-${pricing.discountPercent}%`} />
                </>
              )}
            </Stack>
          </Box>
          <Box
            sx={{
              width: 42,
              height: 42,
              display: 'grid',
              borderRadius: '50%',
              placeItems: 'center',
              color: 'primary.main',
              bgcolor: 'primary.lighter',
              transition: 'transform 180ms ease, color 180ms ease, background-color 180ms ease',
              '.MuiCard-root:hover &': {
                color: 'common.white',
                bgcolor: 'primary.main',
                transform: 'rotate(8deg)',
              },
            }}
          >
            <RiArrowRightUpLine size={21} />
          </Box>
        </Stack>
      </Stack>
    </Card>
  );
}
