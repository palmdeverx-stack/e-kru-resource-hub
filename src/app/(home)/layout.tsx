'use client';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { MainLayout } from 'src/layouts/main';

import { MarketplaceBrand } from 'src/components/marketplace-brand';
import { RiLoginBoxLine, RiDashboardLine } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  const { authenticated, loading } = useAuthContext();

  return (
    <MainLayout
      slotProps={{
        header: {
          slots: {
            leftArea: <MarketplaceBrand />,
            rightArea: (
              <Stack direction="row" spacing={1}>
                {!loading && !authenticated && (
                  <Button
                    href={paths.auth.jwt.signIn}
                    component={RouterLink}
                    color="inherit"
                    startIcon={<RiLoginBoxLine />}
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
              </Stack>
            ),
          },
        },
        footer: { sx: { display: 'none' } },
      }}
    >
      {children}
    </MainLayout>
  );
}
