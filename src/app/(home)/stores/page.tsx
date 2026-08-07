import type { Metadata } from 'next';

import { detectLanguage, getServerTranslations } from 'src/locales/server';

import { MARKETPLACE_OG_IMAGE_URL } from 'src/sections/marketplace/seo/site-url';
import { MarketplaceStoreListView } from 'src/sections/marketplace/seller/view/store-list-view';
import { getPublicPlatformSettings } from 'src/sections/marketplace/admin/server/platform-settings';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await detectLanguage();
  const { t } = await getServerTranslations('marketplace');
  const settings = await getPublicPlatformSettings();
  const platformName =
    (lang === 'en' ? settings?.platform_name_en : settings?.platform_name_th) ||
    settings?.platform_name_th ||
    settings?.platform_name_en ||
    'E-KRU Marketplace';
  const image = settings?.og_image_url || MARKETPLACE_OG_IMAGE_URL;
  const title = t('stores.seo.title', { platformName });
  const description = t('stores.seo.description', { platformName });
  return {
    title,
    description,
    alternates: { canonical: '/stores' },
    openGraph: {
      title,
      description,
      url: '/stores',
      images: [
        { url: image, width: 1080, height: 1080, alt: t('stores.seo.imageAlt', { platformName }) },
      ],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default function Page() {
  return <MarketplaceStoreListView />;
}
