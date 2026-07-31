import type { Metadata } from 'next';

import { getServerTranslations } from 'src/locales/server';

import { MarketplaceCartView } from 'src/sections/marketplace/cart/view/cart-view';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations('marketplace');
  return {
    title: t('cart.seo.title'),
    robots: { index: false, follow: false, nocache: true },
  };
}

export default function Page() {
  return <MarketplaceCartView />;
}
