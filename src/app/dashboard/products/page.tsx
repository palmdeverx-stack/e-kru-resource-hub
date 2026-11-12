import type { Metadata } from 'next';

import { getServerTranslations } from 'src/locales/server';

import { MarketplaceDashboardProductsView } from 'src/sections/marketplace/catalog/view/dashboard-products-view';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations('marketplace');
  return {
    title: t('dashboardUi.productsPage') + ' | E-KRU Marketplace',
    description: t('dashboardUi.productsDescription'),
  };
}

export default function Page() {
  return <MarketplaceDashboardProductsView />;
}
