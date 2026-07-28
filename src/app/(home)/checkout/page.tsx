import type { Metadata } from 'next';

import { MarketplaceCheckoutView } from 'src/sections/marketplace/checkout/view/checkout-view';

export const metadata: Metadata = { title: 'ชำระเงิน | eKru Marketplace' };

export default function Page() {
  return <MarketplaceCheckoutView />;
}
