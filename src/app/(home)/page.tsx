import type { Metadata } from 'next';

import { MarketplaceLandingView } from 'src/sections/marketplace/catalog/view/landing-view';
import { absoluteMarketplaceUrl } from 'src/sections/marketplace/seo/site-url';

// ----------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'E-KRU Marketplace | สื่อการสอนจากครูเพื่อครู',
  description: 'ค้นหา ซื้อ และขายสื่อการสอนคุณภาพจากครูและนักสร้างสรรค์ทั่วประเทศ',
  alternates: { canonical: '/' },
};

export default function Page() {
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
        inLanguage: 'th-TH',
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
