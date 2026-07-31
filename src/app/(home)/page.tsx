import type { Metadata } from 'next';

import { detectLanguage, getServerTranslations } from 'src/locales/server';

import { absoluteMarketplaceUrl } from 'src/sections/marketplace/seo/site-url';
import { MarketplaceLandingView } from 'src/sections/marketplace/catalog/view/landing-view';

// ----------------------------------------------------------------------

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations('marketplace');
  return {
    title: t('seo.title'),
    description: t('seo.description'),
    alternates: { canonical: '/' },
  };
}

export default async function Page() {
  const lang = await detectLanguage();
  const siteUrl = absoluteMarketplaceUrl('/');
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}#organization`,
        name: 'E-KRU',
        url: siteUrl,
        logo: absoluteMarketplaceUrl('/logo/logo-tran-ver.svg'),
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}#website`,
        name: 'E-KRU Marketplace',
        url: siteUrl,
        inLanguage: lang === 'en' ? 'en-US' : 'th-TH',
        publisher: { '@id': `${siteUrl}#organization` },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
      <MarketplaceLandingView />
    </>
  );
}
