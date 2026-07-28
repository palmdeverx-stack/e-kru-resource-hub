import type { Metadata } from 'next';

import { MarketplaceSellerDashboardView } from 'src/sections/marketplace/seller/view/seller-dashboard-view';

export const metadata: Metadata = { title: 'ร้านค้าของฉัน | eKru Marketplace' };

export default function Page() {
  return <MarketplaceSellerDashboardView />;
}
