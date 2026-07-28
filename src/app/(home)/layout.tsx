import { MainLayout } from 'src/layouts/main';

import { MarketplaceBrand } from 'src/components/marketplace-brand';

import { MarketplaceFooter } from 'src/sections/marketplace/shared/footer';
import { MarketplaceHeaderActions } from 'src/sections/marketplace/shared/header-actions';

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <MainLayout
      slotProps={{
        header: {
          slots: {
            leftArea: <MarketplaceBrand />,
            rightArea: <MarketplaceHeaderActions />,
          },
        },
        footerContent: <MarketplaceFooter />,
      }}
    >
      {children}
    </MainLayout>
  );
}
