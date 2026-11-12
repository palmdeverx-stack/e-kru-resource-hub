import type { Metadata } from 'next';

import { getServerTranslations } from 'src/locales/server';

import { MarketplaceDashboardView } from 'src/sections/marketplace/account/view/dashboard-view';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations('marketplace');
  return {
    title: t('dashboardUi.dashboardPage') + ' | E-KRU Marketplace',
    description: t('dashboardUi.dashboardDescription'),
  };
}

export default function Page() {
  return <MarketplaceDashboardView />;
}
