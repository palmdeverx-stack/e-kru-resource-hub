'use client';

import type { MarketplaceProduct } from './types';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Rating from '@mui/material/Rating';
import Typography from '@mui/material/Typography';

import { useTranslate } from 'src/locales';
import { RouterLink } from 'src/routes/components';

import { RiFileLine, RiBookOpenLine, RiGraduationCapLine } from 'src/components/remix-icon';

import { formatPrice, getLocalizedProduct } from './api';

export function MarketplaceProductCard({
  product,
  colorIndex = 0,
}: {
  product: MarketplaceProduct;
  colorIndex?: number;
}) {
  const { currentLang } = useTranslate();
  const content = getLocalizedProduct(product, currentLang.value);
  const fallbackColors = ['#E8F8EF', '#FFF4DE', '#E9F2FF', '#F4ECFF'];
  const coverUrl =
    product.images?.find((image) => image.is_cover)?.url ??
    product.images?.[0]?.url ??
    product.cover_url ??
    undefined;
  const gradeLabel =
    product.grade_levels
      ?.map((item) => item.grade_level.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(', ') || 'ทุกระดับชั้น';
  const rating = product.engagement?.averageRating ?? 0;
  const reviewCount = product.engagement?.reviewCount ?? 0;

  return (
    <Card
      component={RouterLink}
      href={`/product/${product.id}`}
      variant="outlined"
      sx={{
        p: 1.5,
        height: 1,
        display: 'flex',
        overflow: 'hidden',
        borderRadius: 2.5,
        color: 'text.primary',
        textDecoration: 'none',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 14px 36px rgba(15, 23, 42, 0.10)',
          borderColor: 'primary.light',
        },
      }}
    >
      <Box
        sx={{
          width: 1,
          position: 'relative',
          overflow: 'hidden',
          aspectRatio: '4 / 3',
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
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
              objectFit: 'cover',
              transition: 'transform 260ms ease',
              '.MuiCard-root:hover &': { transform: 'scale(1.035)' },
            }}
          />
        ) : (
          <RiBookOpenLine size={56} color="#1565F5" />
        )}
        {product.resource_type === 'feature_unlock' && (
          <Chip
            size="small"
            color="primary"
            label="e-KRU License"
            sx={{ position: 'absolute', top: 10, left: 10, fontWeight: 700 }}
          />
        )}
      </Box>

      <Stack spacing={1.4} sx={{ px: 0.75, pt: 1.5, flexGrow: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Avatar
            src={product.seller?.logo_url ?? undefined}
            alt={product.seller?.display_name}
            sx={{ width: 28, height: 28, bgcolor: 'primary.lighter', color: 'primary.main' }}
          >
            {product.seller?.display_name?.charAt(0) || 'e'}
          </Avatar>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ flexGrow: 1 }}>
            {product.seller?.display_name ?? 'ผู้ขาย eKru'}
          </Typography>
          {product.category && (
            <Chip
              size="small"
              variant="soft"
              color="success"
              label={product.category}
              sx={{ maxWidth: 105, '& .MuiChip-label': { overflow: 'hidden' } }}
            />
          )}
        </Stack>

        <Typography
          variant="subtitle1"
          sx={{
            minHeight: 48,
            lineHeight: 1.45,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {content.title}
        </Typography>

        <Stack direction="row" spacing={1.5} color="text.secondary">
          <Stack direction="row" spacing={0.6} alignItems="center" sx={{ minWidth: 0 }}>
            <RiFileLine size={15} />
            <Typography variant="caption" noWrap>
              {product.media_type?.name ??
                (product.resource_type === 'digital' ? 'ไฟล์ดิจิทัล' : 'สื่อการสอน')}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.6} alignItems="center" sx={{ minWidth: 0 }}>
            <RiGraduationCapLine size={15} />
            <Typography variant="caption" noWrap>
              {gradeLabel}
            </Typography>
          </Stack>
        </Stack>

        <Box
          sx={{
            mt: 'auto !important',
            px: 1.25,
            py: 1.1,
            borderRadius: 1.5,
            bgcolor: 'success.lighter',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Typography variant="subtitle1" color="success.darker" sx={{ fontWeight: 800 }}>
              {formatPrice(Number(product.price), product.currency)}
            </Typography>
            {reviewCount ? (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  {rating.toFixed(1)}
                </Typography>
                <Rating value={rating} precision={0.1} readOnly size="small" />
                <Typography variant="caption" color="text.secondary">
                  ({reviewCount})
                </Typography>
              </Stack>
            ) : (
              <Typography variant="caption" color="text.secondary">
                สินค้าใหม่
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>
    </Card>
  );
}
