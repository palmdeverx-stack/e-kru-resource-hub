import type { Metadata } from 'next';

import { getServerTranslations } from 'src/locales/server';

import { MarketplaceStorefrontView } from 'src/sections/marketplace/seller/view/storefront-view';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations('marketplace');

  return { title: t('storefront.seo.dashboardTitle') };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return <MarketplaceStorefrontView slug={slug} dashboardMode />;
}
