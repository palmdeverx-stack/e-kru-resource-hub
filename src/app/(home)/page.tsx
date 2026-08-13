import type { Metadata } from 'next';

import { detectLanguage, getServerTranslations } from 'src/locales/server';

import { absoluteMarketplaceUrl } from 'src/sections/marketplace/seo/site-url';
import { MarketplaceLandingView } from 'src/sections/marketplace/catalog/view/landing-view';
import {
  MARKETPLACE_SEO_KEYWORDS,
  MARKETPLACE_BRAND_ALIASES,
} from 'src/sections/marketplace/seo/keywords';

// ----------------------------------------------------------------------

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations('marketplace');
  return {
    title: t('seo.title'),
    description: t('seo.description'),
    keywords: MARKETPLACE_SEO_KEYWORDS,
    alternates: { canonical: '/' },
  };
}

export default async function Page() {
  const [lang, { t }] = await Promise.all([detectLanguage(), getServerTranslations('marketplace')]);
  const siteUrl = absoluteMarketplaceUrl('/');
  const searchUrlTemplate = `${siteUrl.replace(/\/$/, '')}/products?q={search_term_string}`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}#organization`,
        name: 'E-KRU',
        alternateName: MARKETPLACE_BRAND_ALIASES,
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
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: searchUrlTemplate,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'WebPage',
        '@id': `${siteUrl}#webpage`,
        url: siteUrl,
        name: t('seo.title'),
        description: t('seo.description'),
        keywords: MARKETPLACE_SEO_KEYWORDS.join(', '),
        isPartOf: { '@id': `${siteUrl}#website` },
        about: { '@id': `${siteUrl}#organization` },
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
