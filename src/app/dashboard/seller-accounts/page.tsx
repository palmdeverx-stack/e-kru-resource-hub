import type { Metadata } from 'next';

import { MarketplaceSellerAccountListView } from 'src/sections/marketplace/admin/view/seller-account-list-view';

export const metadata: Metadata = { title: 'บัญชีร้านค้าในระบบ | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceSellerAccountListView />;
}
