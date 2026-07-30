import type { Metadata } from 'next';

import { MarketplacePurchasesView } from 'src/sections/marketplace/account/view/purchases-view';

export const metadata: Metadata = { title: 'รายการซื้อ | E-KRU Marketplace' };

export default function Page() {
  return <MarketplacePurchasesView />;
}
