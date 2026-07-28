'use client';

import type { NavSectionProps } from 'src/components/nav-section';

import Button from '@mui/material/Button';

import { RouterLink } from 'src/routes/components';

import { DashboardLayout } from 'src/layouts/dashboard';

import { MarketplaceBrand } from 'src/components/marketplace-brand';
import { RiHome5Line, RiDashboardLine } from 'src/components/remix-icon';

const navData: NavSectionProps['data'] = [
  {
    subheader: 'eKru',
    items: [
      {
        title: 'Dashboard',
        path: '/dashboard',
        icon: <RiDashboardLine />,
      },
    ],
  },
];

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <DashboardLayout
      slotProps={{
        nav: {
          data: navData,
          headerIdentity: (
            <div style={{ padding: '20px 28px 8px' }}>
              <MarketplaceBrand />
            </div>
          ),
        },
        header: {
          slots: {
            rightArea: (
              <Button
                href="/"
                component={RouterLink}
                variant="outlined"
                startIcon={<RiHome5Line />}
              >
                Main
              </Button>
            ),
          },
        },
      }}
    >
      {children}
    </DashboardLayout>
  );
}
