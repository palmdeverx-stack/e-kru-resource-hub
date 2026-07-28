import type { Metadata } from 'next';

import { MarketplaceSellerLineGuideView } from 'src/sections/marketplace/seller/view/seller-line-guide-view';

export const metadata: Metadata = {
  title: 'วิธีตั้งค่า LINE | E-KRU Marketplace',
};

export default function Page() {
  return <MarketplaceSellerLineGuideView />;
}
