import type { Metadata } from 'next';

import { MarketplaceCartView } from 'src/sections/marketplace/cart/view/cart-view';

export const metadata: Metadata = { title: 'ตะกร้าของฉัน | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceCartView dashboardMode />;
}
