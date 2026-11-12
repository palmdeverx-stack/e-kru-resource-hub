import type { Metadata } from 'next';

import { getServerTranslations } from 'src/locales/server';

import { MarketplaceSellerFinanceView } from 'src/sections/marketplace/seller/view/seller-finance-view';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations('marketplace');
  return {
    title: t('dashboardUi.sellerFinancePage') + ' | E-KRU Marketplace',
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; productId?: string }>;
}) {
  const params = await searchParams;

  return (
    <MarketplaceSellerFinanceView
      initialTab={params.tab === 'sales' || params.tab === 'payouts' ? params.tab : 'income'}
      productId={params.productId?.trim() || undefined}
    />
  );
}
