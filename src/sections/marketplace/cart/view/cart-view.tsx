'use client';

import { useEffect } from 'react';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { SplashScreen } from 'src/components/loading-screen';

import { useAuthContext } from 'src/auth/hooks';

import { MarketplaceCartContent } from './cart-content';

export function MarketplaceCartView() {
  const router = useRouter();
  const { authenticated, loading } = useAuthContext();

  useEffect(() => {
    if (!loading && authenticated) {
      router.replace(paths.marketplace.dashboardCart);
    }
  }, [authenticated, loading, router]);

  if (loading || authenticated) {
    return <SplashScreen portal={false} />;
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 8 } }}>
      <MarketplaceCartContent
        productsHref={paths.marketplace.products}
        checkoutHref={paths.marketplace.checkout}
      />
    </Container>
  );
}
