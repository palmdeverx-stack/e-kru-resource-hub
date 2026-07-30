import type { Metadata } from 'next';

import { MarketplaceCartView } from 'src/sections/marketplace/cart/view/cart-view';

export const metadata: Metadata = {
  title: 'ตะกร้า | E-KRU Marketplace',
  robots: { index: false, follow: false, nocache: true },
};

export default function Page() {
  return <MarketplaceCartView />;
}
