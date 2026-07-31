import type { Metadata } from 'next';

import { MARKETPLACE_OG_IMAGE_URL } from 'src/sections/marketplace/seo/site-url';
import { MarketplaceStoreListView } from 'src/sections/marketplace/seller/view/store-list-view';
import { getPublicPlatformSettings } from 'src/sections/marketplace/admin/server/platform-settings';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicPlatformSettings();
  const platformName = settings?.platform_name_th || 'E-KRU Marketplace';
  const image = settings?.og_image_url || MARKETPLACE_OG_IMAGE_URL;
  const title = `ร้านค้า | ${platformName}`;
  const description = `ค้นหาร้านค้า ครูผู้สอน และผู้สร้างสื่อที่ผ่านการอนุมัติจาก ${platformName}`;
  return {
    title,
    description,
    alternates: { canonical: '/stores' },
    openGraph: {
      title,
      description,
      url: '/stores',
      images: [{ url: image, alt: `ร้านค้าบน ${platformName}` }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default function Page() {
  return <MarketplaceStoreListView />;
}
