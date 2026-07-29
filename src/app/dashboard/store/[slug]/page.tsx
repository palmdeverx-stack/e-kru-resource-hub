import type { Metadata } from 'next';

import { MarketplaceStorefrontView } from 'src/sections/marketplace/seller/view/storefront-view';

export const metadata: Metadata = { title: 'โปรไฟล์ร้านค้า | E-KRU Marketplace' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return <MarketplaceStorefrontView slug={slug} dashboardMode />;
}
