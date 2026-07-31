import type { Metadata } from 'next';

import { detectLanguage, getServerTranslations } from 'src/locales/server';

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
  const [lang, translations, store, settings] = await Promise.all([
    detectLanguage(),
    getServerTranslations('marketplace'),
    getPublicStoreSeo(slug),
    getPublicPlatformSettings(),
  ]);
  const { t } = translations;
  const platformName =
    (lang === 'en' ? settings?.platform_name_en : settings?.platform_name_th) ||
    settings?.platform_name_th ||
    settings?.platform_name_en ||
    'E-KRU Marketplace';

  if (!store) {
    return {
      title: t('storefront.seo.notFoundTitle', { platformName }),
      robots: { index: false, follow: false },
    };
  }

  const storeName =
    lang === 'en' && store.display_name_en?.trim() ? store.display_name_en : store.display_name;
  const description =
    store.bio || t('storefront.seo.description', { storeName });
  const identifier = store.slug || store.id;
  const path = `/store/${encodeURIComponent(identifier)}`;
  const image =
    store.cover_url || store.logo_url || settings?.og_image_url || MARKETPLACE_OG_IMAGE_URL;

  return {
    title: t('storefront.seo.title', { storeName, platformName }),
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'profile',
      locale: lang === 'en' ? 'en_US' : 'th_TH',
      title: storeName,
      description,
      url: path,
      images: [{ url: image, alt: storeName }],
    },
    twitter: {
      card: 'summary_large_image',
      title: storeName,
      description,
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
