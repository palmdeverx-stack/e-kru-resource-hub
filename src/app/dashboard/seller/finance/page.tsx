import type { Metadata } from 'next';

import { MarketplaceSellerFinanceView } from 'src/sections/marketplace/seller/view/seller-finance-view';

export const metadata: Metadata = { title: 'รายได้ของร้าน | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceSellerFinanceView />;
}
