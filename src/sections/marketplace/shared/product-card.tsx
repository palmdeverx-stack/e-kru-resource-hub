'use client';

import type { MarketplaceProduct } from './types';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Rating from '@mui/material/Rating';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import {
  RiEyeLine,
  RiHeartLine,
  RiBookOpenLine,
  RiVipCrownFill,
  RiShoppingBag3Line,
} from 'src/components/remix-icon';

import { getMarketplacePricing } from './pricing';
import { MarketplaceSellerLink } from './seller-link';
import { formatPrice, getLocalizedProduct } from './api';

const categoryTranslationKeys: Record<string, string> = {
  แผนการสอน: 'lessonPlans',
  ใบงาน: 'worksheets',
  สื่อประกอบ: 'supplementary',
  แบบทดสอบ: 'quizzes',
  คอร์สเรียน: 'courses',
};

export function MarketplaceProductCard({
  product,
  colorIndex = 0,
  productHref,
}: {
  product: MarketplaceProduct;
  colorIndex?: number;
  productHref?: string;
}) {
  const theme = useTheme();
  const { t, currentLang } = useTranslate('marketplace');
  const numberLocale = currentLang.numberFormat.code;
  const content = getLocalizedProduct(product, currentLang.value);
  const fallbackColors = ['#E8F8EF', '#FFF4DE', '#E9F2FF', '#F4ECFF'];
  const coverUrl =
    product.images?.find((image) => image.is_cover)?.url ??
    product.images?.[0]?.url ??
    product.cover_url ??
    undefined;
  const rating = product.engagement?.averageRating ?? 0;
  const reviewCount = product.engagement?.reviewCount ?? 0;
  const views = product.engagement?.views ?? 0;
  const likes = product.engagement?.likes ?? 0;
  const purchases = product.engagement?.purchases ?? 0;
  const pricing = getMarketplacePricing(product);
  const href = productHref ?? `/product/${product.id}`;

  return (
    <Card
      sx={{
        p: 1.25,
        height: 1,
        display: 'flex',
        overflow: 'hidden',
        position: 'relative',
        borderRadius: 2,
        color: 'text.primary',
        textDecoration: 'none',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 8px 28px rgba(15, 23, 42, 0.06)',
        transition: 'transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease',
        '&:hover': {
          transform: 'translateY(-6px)',
          boxShadow: '0 18px 42px rgba(21, 101, 245, 0.13)',
          borderColor: 'primary.light',
        },
      }}
    >
      {pricing.salePrice > 0 && (
        <Box
          role="img"
          aria-label={t('productCard.premium')}
          title={t('productCard.premium')}
          sx={{
            top: 16,
            right: 16,
            zIndex: 2,
            width: 30,
            height: 30,
            display: 'grid',
            position: 'absolute',
            borderRadius: '50%',
            placeItems: 'center',
            color: theme.palette.primary.main,
            background: 'linear-gradient(145deg, #ececec 0%, #d2dbff 10%)',
            transition: 'transform 220ms ease, box-shadow 220ms ease',
          }}
        >
          <RiVipCrownFill size={16} style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.26))' }} />
        </Box>
      )}
      <Box
        component={RouterLink}
        href={href}
        aria-label={t('productCard.viewProduct', { title: content.title })}
        sx={{
          width: 1,
          flex: '0 0 auto',
          position: 'relative',
          overflow: 'hidden',
          aspectRatio: '16 / 11',
          borderRadius: 1.2,
          display: 'grid',
          placeItems: 'center',
          textDecoration: 'none',
          bgcolor: fallbackColors[colorIndex % fallbackColors.length],
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
              inset: 0,
              display: 'block',
              position: 'absolute',
              objectFit: 'cover',
              objectPosition: 'center',
              transition: 'transform 260ms ease',
              '@media (hover: hover)': {
                '.MuiCard-root:hover &': { transform: 'scale(1.045)' },
              },
            }}
          />
        ) : (
          <RiBookOpenLine size={56} color="#1565F5" />
        )}
        <Box
          sx={{
            inset: 0,
            position: 'absolute',
            pointerEvents: 'none',
            background:
              'linear-gradient(180deg, rgba(15,23,42,0.03), transparent 42%), linear-gradient(0deg, rgba(15,23,42,0.52), transparent 38%)',
          }}
        />
        {/* {product.resource_type === 'feature_unlock' && (
          <Chip
            size="small"
            color="primary"
            label={'s}
            sx={{
              top: 12,
              left: 12,
              fontWeight: 700,
              position: 'absolute',
              boxShadow: '0 6px 16px rgba(21,101,245,0.20)',
            }}
          />
        )} */}
        {product.category && (
          <Chip
            size="small"
            color="primary"
            label={
              categoryTranslationKeys[product.category]
                ? t(`catalog.categoryLabels.${categoryTranslationKeys[product.category]}`)
                : product.category
            }
            sx={{
              bottom: 8,
              right: 12,
              fontWeight: 700,
              position: 'absolute',
              boxShadow: '0 6px 16px rgba(21,101,245,0.20)',
            }}
          />
        )}
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{
            left: 14,
            bottom: 12,
            zIndex: 1,
            position: 'absolute',
            color: 'common.white',
            filter: 'drop-shadow(0 1px 2px rgba(15,23,42,0.45))',
          }}
        >
          {[
            { label: t('productCard.views'), value: views, icon: <RiEyeLine size={16} /> },
            { label: t('productCard.likes'), value: likes, icon: <RiHeartLine size={16} /> },
            {
              label: t('productCard.orders'),
              value: purchases,
              icon: <RiShoppingBag3Line size={16} />,
            },
          ].map((stat) => (
            <Stack
              key={stat.label}
              direction="row"
              spacing={0.5}
              alignItems="center"
              aria-label={`${stat.label} ${stat.value.toLocaleString(numberLocale)}`}
              title={stat.label}
            >
              <Box component="span" sx={{ display: 'inline-flex' }}>
                {stat.icon}
              </Box>
              <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 700 }}>
                {stat.value.toLocaleString(numberLocale)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Stack spacing={1.5} sx={{ pt: 1.75, flexGrow: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <MarketplaceSellerLink
            seller={product.seller}
            avatarSize={30}
            nameVariant="caption"
            sx={{ minWidth: 0, flex: 1 }}
            nameSx={{ color: 'text.secondary', fontWeight: 700 }}
          />
          {/* {product.category && (
            <Chip
              size="small"
              variant="soft"
              color="primary"
              label={
                categoryTranslationKeys[product.category]
                  ? t(`catalog.categoryLabels.${categoryTranslationKeys[product.category]}`)
                  : product.category
              }
              sx={{
                maxWidth: '46%',
                flexShrink: 1,
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                },
              }}
            />
          )} */}
        </Stack>

        <Typography
          component={RouterLink}
          href={href}
          variant="h6"
          sx={{
            color: 'text.primary',
            minHeight: 54,
            lineHeight: 1.4,
            fontWeight: 750,
            textDecoration: 'none',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {content.title}
        </Typography>

        <Box
          sx={{
            mt: 'auto !important',
            pt: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-end" spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                {t('productCard.price')}
              </Typography>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h6" color="primary.main" sx={{ fontWeight: 800 }}>
                  {formatPrice(pricing.salePrice, product.currency, numberLocale)}
                </Typography>
                {pricing.hasDiscount && (
                  <>
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{ textDecoration: 'line-through' }}
                    >
                      {formatPrice(pricing.listPrice, product.currency, numberLocale)}
                    </Typography>
                    <Chip size="small" color="error" label={`-${pricing.discountPercent}%`} />
                  </>
                )}
              </Stack>
            </Box>
            <Box sx={{ flexShrink: 0, textAlign: 'right' }}>
              {reviewCount ? (
                <>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                    justifyContent="flex-end"
                  >
                    <Rating max={1} value={1} readOnly size="small" />
                    <Typography variant="subtitle2">{rating.toFixed(1)}</Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {t('productCard.reviews', {
                      formattedCount: reviewCount.toLocaleString(numberLocale),
                    })}
                  </Typography>
                </>
              ) : (
                <Chip size="small" variant="soft" color="primary" label={t('productCard.new')} />
              )}
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Card>
  );
}
