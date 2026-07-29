"use client";

import Badge from '@mui/material/Badge';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { usePathname, useSearchParams } from 'src/routes/hooks';

import { RiLoginBoxLine, RiDashboardLine, RiShoppingBag3Line } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { useMarketplaceCart } from '../cart/cart-context';
import { MarketplaceAccountMenu } from '../account/components/account-menu';

export function MarketplaceHeaderActions() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { itemCount } = useMarketplaceCart();
  const { authenticated, loading } = useAuthContext();
  const query = searchParams.toString();
  const returnTo = `${pathname}${query ? `?${query}` : ''}`;
  const signInHref = `${paths.auth.jwt.signIn}?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <IconButton component={RouterLink} href="/cart" aria-label={`ตะกร้า ${itemCount} รายการ`}>
        <Badge badgeContent={itemCount} color="primary">
          <RiShoppingBag3Line />
        </Badge>
      </IconButton>

      {!loading && !authenticated && (
        <Button
          href={signInHref}
          component={RouterLink}
          color="inherit"
          startIcon={<RiLoginBoxLine />}
          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
        >
          เข้าสู่ระบบ
        </Button>
      )}

      <Button
        href={authenticated ? paths.marketplace.dashboard : paths.auth.jwt.signUp}
        component={RouterLink}
        variant="contained"
        startIcon={<RiDashboardLine />}
      >
        {authenticated ? 'Dashboard' : 'สมัครใช้งาน'}
      </Button>

      <MarketplaceAccountMenu />
    </Stack>
  );
}
