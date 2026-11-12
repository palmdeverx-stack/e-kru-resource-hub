import type { Metadata } from 'next';

import { getServerTranslations } from 'src/locales/server';

import { MarketplaceSellerDashboardView } from 'src/sections/marketplace/seller/view/seller-dashboard-view';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations('marketplace');
  return {
    title: t('dashboardUi.sellerPage') + ' | E-KRU Marketplace',
  };
}

export default function Page() {
  return <MarketplaceSellerDashboardView />;
}
