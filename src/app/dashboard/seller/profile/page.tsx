import type { Metadata } from 'next';

import { MarketplaceSellerProfileView } from 'src/sections/marketplace/seller/view/seller-profile-view';

export const metadata: Metadata = { title: 'ข้อมูลร้านค้า | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceSellerProfileView />;
}
