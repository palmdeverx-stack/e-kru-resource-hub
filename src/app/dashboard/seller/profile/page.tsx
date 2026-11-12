import type { Metadata } from 'next';

import { getServerTranslations } from 'src/locales/server';

import { MarketplaceSellerProfileView } from 'src/sections/marketplace/seller/view/seller-profile-view';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations('marketplace');
  return {
    title: t('dashboardUi.sellerProfilePage') + ' | E-KRU Marketplace',
  };
}

export default function Page() {
  return <MarketplaceSellerProfileView />;
}
