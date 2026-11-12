import { MainLayout } from 'src/layouts/main';

import { MarketplaceBrand } from 'src/components/marketplace-brand';

import { MarketplaceFooter } from 'src/sections/marketplace/shared/footer';
import { MarketplaceHeaderActions } from 'src/sections/marketplace/shared/header-actions';

import { LineEntryBridge } from 'src/auth/components/line-entry-bridge';

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <MainLayout
      slotProps={{
        main: {
          sx: { mt: 0 },
        },
        header: {
          slots: {
            leftArea: <MarketplaceBrand width={56} height={48} />,
            rightArea: <MarketplaceHeaderActions />,
          },
          slotProps: {
            centerArea: { sx: { ml: { md: 4 } } },
            container: {
              sx: {
                px: { xs: 1.5, sm: 3 },
              },
            },
          },
          sx: {
            '--layout-header-mobile-height': '56px',
          },
        },
        footerContent: <MarketplaceFooter />,
      }}
    >
      <LineEntryBridge />
      {children}
    </MainLayout>
  );
}
