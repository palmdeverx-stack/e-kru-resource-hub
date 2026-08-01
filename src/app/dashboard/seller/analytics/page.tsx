import type { Metadata } from 'next';

import { MarketplaceSellerAnalyticsView } from 'src/sections/marketplace/seller/view/seller-analytics-view';

export const metadata: Metadata = { title: 'สถิติร้านค้า | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceSellerAnalyticsView />;
}
