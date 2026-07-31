import type { Metadata } from 'next';

import { getPublicStoreSeo } from 'src/sections/marketplace/seo/server';
import { MarketplaceStorefrontView } from 'src/sections/marketplace/seller/view/storefront-view';
import { getPublicPlatformSettings } from 'src/sections/marketplace/admin/server/platform-settings';
import {
  absoluteMarketplaceUrl,
  MARKETPLACE_OG_IMAGE_URL,
} from 'src/sections/marketplace/seo/site-url';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [store, settings] = await Promise.all([
    getPublicStoreSeo(slug),
    getPublicPlatformSettings(),
  ]);
  const platformName = settings?.platform_name_th || 'E-KRU Marketplace';

  if (!store) {
    return {
      title: `ไม่พบร้านค้า | ${platformName}`,
      robots: { index: false, follow: false },
    };
  }

  const identifier = store.slug || store.id;
  const path = `/store/${encodeURIComponent(identifier)}`;
  const image =
    store.cover_url || store.logo_url || settings?.og_image_url || MARKETPLACE_OG_IMAGE_URL;

  return {
    title: `${store.display_name} | ${platformName}`,
    description: store.description,
    alternates: { canonical: path },
    openGraph: {
      type: 'profile',
      locale: 'th_TH',
      title: store.display_name,
      description: store.description,
      url: path,
      images: [{ url: image, alt: store.display_name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: store.display_name,
      description: store.description,
      images: [image],
    },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const store = await getPublicStoreSeo(slug);
  const identifier = store?.slug || store?.id || slug;
  const storeUrl = absoluteMarketplaceUrl(`/store/${encodeURIComponent(identifier)}`);
  const structuredData = store
    ? {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        mainEntity: {
          '@type':
            store.seller_type === 'teacher' || store.seller_type === 'individual'
              ? 'Person'
              : 'Organization',
          name: store.display_name,
          alternateName: store.display_name_en || undefined,
          description: store.description,
          url: storeUrl,
          image: store.logo_url || store.cover_url || undefined,
        },
      }
    : null;

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
          }}
        />
      )}
      <MarketplaceStorefrontView slug={slug} />
    </>
  );
}
