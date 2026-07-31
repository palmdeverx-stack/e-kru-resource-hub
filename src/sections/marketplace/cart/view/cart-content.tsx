'use client';

import type { MarketplaceProduct } from '../../shared/types';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import {
  RiEyeLine,
  RiFileLine,
  RiDeleteBinLine,
  RiArrowLeftLine,
  RiShoppingBag3Line,
  RiGraduationCapLine,
} from 'src/components/remix-icon';

import { useMarketplaceCart } from '../cart-context';
import { getMarketplacePricing } from '../../shared/pricing';
import { MarketplaceSellerLink } from '../../shared/seller-link';
import { formatPrice, getLocalizedProduct } from '../../shared/api';
import { MarketplaceProductDetailDialog } from '../../catalog/components/product-detail-dialog';

type MarketplaceCartContentProps = {
  productsHref: string;
  checkoutHref: string;
};

export function MarketplaceCartContent({
  productsHref,
  checkoutHref,
}: MarketplaceCartContentProps) {
  const { t, currentLang } = useTranslate('marketplace');
  const { items, subtotal, listSubtotal, discountTotal, removeItem } = useMarketplaceCart();
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);

  if (!items.length) {
    return (
      <Container maxWidth="sm" sx={{ py: 12, textAlign: 'center' }}>
        <Box
          sx={{
            width: 88,
            height: 88,
            mx: 'auto',
            display: 'grid',
            borderRadius: 3,
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: 'primary.lighter',
          }}
        >
          <RiShoppingBag3Line size={42} />
        </Box>
        <Typography variant="h3" sx={{ mt: 3 }}>
          {t('cart.empty.title')}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          {t('cart.empty.description')}
        </Typography>
        <Button
          component={RouterLink}
          href={productsHref}
          variant="contained"
          startIcon={<RiArrowLeftLine />}
        >
          {t('cart.actions.browse')}
        </Button>
      </Container>
    );
  }

  return (
    <>
      <Typography component="h1" variant="h3">
        {t('cart.heading')}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: { xs: 2.5, sm: 4 } }}>
        {t('cart.description')}
      </Typography>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 2, md: 3 }}
        alignItems="flex-start"
      >
        <Stack spacing={2} sx={{ flex: 1, width: 1 }}>
          {items.map(({ product }) => {
            const content = getLocalizedProduct(product, currentLang.value);
            const pricing = getMarketplacePricing(product);
            const coverUrl =
              product.images?.find((image) => image.is_cover)?.url ??
              product.images?.[0]?.url ??
              product.cover_url;
            const gradeLabel =
              product.grade_levels
                ?.map((item) => item.grade_level.name)
                .filter(Boolean)
                .slice(0, 2)
                .join(', ') || t('cart.product.allGrades');
            const mediaLabel =
              product.media_type?.name ??
              (product.resource_type === 'feature_unlock'
                ? t('cart.product.license')
                : t('cart.product.digitalFile'));

            return (
              <Card
                key={product.id}
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 3,
                  transition: 'border-color 160ms ease, box-shadow 160ms ease',
                  '&:hover': {
                    borderColor: 'primary.light',
                    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
                  },
                }}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Box
                    component="button"
                    type="button"
                    aria-label={t('productCard.viewProduct', { title: content.title })}
                    onClick={() => setSelectedProduct(product)}
                    sx={{
                      p: 0,
                      width: { xs: 1, sm: 160 },
                      height: { xs: 'auto', sm: 160 },
                      aspectRatio: { xs: '16 / 9', sm: 'auto' },
                      border: 0,
                      flexShrink: 0,
                      display: 'grid',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      borderRadius: 2,
                      placeItems: 'center',
                      bgcolor: 'primary.lighter',
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
                          display: 'block',
                          objectFit: { xs: 'contain', sm: 'cover' },
                          objectPosition: 'center',
                          transition: 'transform 220ms ease',
                          '@media (hover: hover)': {
                            '&:hover': { transform: 'scale(1.035)' },
                          },
                        }}
                      />
                    ) : (
                      <RiShoppingBag3Line size={42} color="#1565F5" />
                    )}
                  </Box>

                  <Stack spacing={1.25} sx={{ flexGrow: 1, minWidth: 0, py: 0.5 }}>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {product.category && (
                        <Chip
                          size="small"
                          variant="soft"
                          color="success"
                          label={product.category}
                        />
                      )}
                      {product.resource_type === 'feature_unlock' && (
                        <Chip size="small" variant="soft" color="primary" label="E-KRU License" />
                      )}
                    </Stack>

                    <Typography
                      variant="h6"
                      sx={{
                        lineHeight: 1.45,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {content.title}
                    </Typography>

                    {content.shortDescription && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {content.shortDescription}
                      </Typography>
                    )}

                    <MarketplaceSellerLink
                      seller={product.seller}
                      avatarSize={24}
                      nameVariant="body2"
                      nameSx={{ color: 'text.secondary' }}
                    />

                    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                      <Stack direction="row" spacing={0.6} alignItems="center">
                        <RiFileLine size={16} />
                        <Typography variant="caption" color="text.secondary">
                          {mediaLabel}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.6} alignItems="center">
                        <RiGraduationCapLine size={16} />
                        <Typography variant="caption" color="text.secondary">
                          {gradeLabel}
                        </Typography>
                      </Stack>
                    </Stack>

                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      alignItems={{ xs: 'stretch', sm: 'center' }}
                      sx={{ mt: 'auto !important' }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 'auto' }}>
                        <Typography variant="h5" color="primary.main">
                          {formatPrice(pricing.salePrice, product.currency)}
                        </Typography>
                        {pricing.hasDiscount && (
                          <>
                            <Typography
                              variant="body2"
                              color="text.disabled"
                              sx={{ textDecoration: 'line-through' }}
                            >
                              {formatPrice(pricing.listPrice, product.currency)}
                            </Typography>
                            <Chip
                              size="small"
                              color="error"
                              label={`-${pricing.discountPercent}%`}
                            />
                          </>
                        )}
                      </Stack>
                      <Stack spacing={1} sx={{ display: 'flex', flexDirection: 'row' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          fullWidth
                          startIcon={<RiEyeLine />}
                          sx={{ minWidth: 140 }}
                          onClick={() => setSelectedProduct(product)}
                        >
                          {t('cart.actions.viewDetails')}
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          fullWidth
                          startIcon={<RiDeleteBinLine />}
                          onClick={() => removeItem(product.id)}
                        >
                          {t('cart.actions.remove')}
                        </Button>
                      </Stack>
                    </Stack>
                  </Stack>
                </Stack>
              </Card>
            );
          })}
        </Stack>

        <Card
          sx={{
            p: { xs: 2, sm: 3 },
            width: { xs: 1, md: 360 },
            position: { md: 'sticky' },
            top: { md: 96 },
          }}
        >
          <Typography variant="h5">{t('cart.summary.title')}</Typography>
          <Stack spacing={2} sx={{ mt: 3 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">
                {t('cart.summary.listPrice', { count: items.length })}
              </Typography>
              <Typography>{formatPrice(listSubtotal)}</Typography>
            </Stack>
            {discountTotal > 0 && (
              <Stack direction="row" justifyContent="space-between">
                <Typography color="success.main">{t('cart.summary.discount')}</Typography>
                <Typography color="success.main">-{formatPrice(discountTotal)}</Typography>
              </Stack>
            )}
            <Divider />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="h6">{t('cart.summary.total')}</Typography>
              <Typography variant="h5" color="primary.main">
                {formatPrice(subtotal)}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {t('cart.summary.feeNote')}
            </Typography>
            <Button
              size="large"
              variant="contained"
              component={RouterLink}
              href={checkoutHref}
              fullWidth
            >
              {t('cart.actions.checkout')}
            </Button>
            <Button component={RouterLink} href={productsHref} color="inherit" fullWidth>
              {t('cart.actions.continueShopping')}
            </Button>
          </Stack>
        </Card>
      </Stack>

      <MarketplaceProductDetailDialog
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </>
  );
}
