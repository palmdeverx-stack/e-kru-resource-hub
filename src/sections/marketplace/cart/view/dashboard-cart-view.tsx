'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import { MarketplaceCartContent } from './cart-content';

export function MarketplaceDashboardCartView() {
  return (
    <Container maxWidth={false} sx={{ py: { xs: 4, md: 8 } }}>
      <MarketplaceCartContent
        productsHref={paths.marketplace.dashboardProducts}
        checkoutHref={paths.marketplace.dashboardCheckout}
      />
    </Container>
  );
}
