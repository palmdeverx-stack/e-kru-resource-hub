import type { Metadata } from 'next';

import { MARKETPLACE_OG_IMAGE_URL } from 'src/sections/marketplace/seo/site-url';
import { MarketplaceCatalogView } from 'src/sections/marketplace/catalog/view/catalog-view';
import { getPublicPlatformSettings } from 'src/sections/marketplace/admin/server/platform-settings';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicPlatformSettings();
  const platformName = settings?.platform_name_th || 'E-KRU Marketplace';
  const image = settings?.og_image_url || MARKETPLACE_OG_IMAGE_URL;
  const title = `สื่อการสอนทั้งหมด | ${platformName}`;
  const description = 'เลือกซื้อแผนการสอน ใบงาน แบบทดสอบ และสื่อการเรียนรู้จากชุมชน E-KRU';
  return {
    title,
    description,
    alternates: { canonical: '/products' },
    openGraph: {
      title,
      description,
      url: '/products',
      images: [{ url: image, alt: `สื่อการสอน ${platformName}` }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default function Page() {
  return <MarketplaceCatalogView />;
}
