import type { Metadata } from 'next';

import { MarketplaceDashboardCartView } from 'src/sections/marketplace/cart/view/dashboard-cart-view';

export const metadata: Metadata = { title: 'ตะกร้าของฉัน | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceDashboardCartView />;
}
