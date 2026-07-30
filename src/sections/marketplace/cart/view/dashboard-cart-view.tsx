'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import { MarketplaceCartContent } from './cart-content';

export function MarketplaceDashboardCartView() {
  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <MarketplaceCartContent
        productsHref={paths.marketplace.dashboardProducts}
        checkoutHref={paths.marketplace.dashboardCheckout}
      />
    </Container>
  );
}
