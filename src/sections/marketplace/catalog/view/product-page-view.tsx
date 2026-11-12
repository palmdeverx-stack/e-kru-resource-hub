'use client';

import Button from '@mui/material/Button';
import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import { RiArrowLeftLine } from 'src/components/remix-icon';

import { MarketplaceProductDetailView } from './product-detail-view';

export function MarketplaceProductPageView({ productId }: { productId: string }) {
  const { t } = useTranslate('marketplace');
  return (
    <>
      <Container maxWidth="lg" sx={{ pt: { xs: 2, md: 3 } }}>
        <Button
          component={RouterLink}
          href={paths.marketplace.products}
          color="inherit"
          startIcon={<RiArrowLeftLine />}
        >
          {t('productDetail.actions.backToProducts')}
        </Button>
      </Container>
      <MarketplaceProductDetailView key={productId} productId={productId} expanded />
    </>
  );
}
