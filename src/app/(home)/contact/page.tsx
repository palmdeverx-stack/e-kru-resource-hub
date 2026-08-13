import type { Metadata } from 'next';

import { getServerTranslations } from 'src/locales/server';

import { MarketplaceContactView } from 'src/sections/marketplace/shared/contact-view';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations('marketplace');
  const title = t('contactPage.seo.title');
  const description = t('contactPage.seo.description');

  return {
    title,
    description,
    alternates: { canonical: '/contact' },
    openGraph: { title, description, url: '/contact', type: 'website' },
  };
}

export default function Page() {
  return <MarketplaceContactView />;
}
