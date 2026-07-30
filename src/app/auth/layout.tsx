import type { Metadata } from 'next';

import { AuthCenteredLayout } from 'src/layouts/auth-centered';

import { MarketplaceBrand } from 'src/components/marketplace-brand';

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <AuthCenteredLayout
      slotProps={{
        header: {
          slots: {
            leftArea: <MarketplaceBrand compact />,
          },
        },
      }}
      sx={{
        '&::before': {
          opacity: 1,
          display: 'block',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        },
      }}
    >
      {children}
    </AuthCenteredLayout>
  );
}
