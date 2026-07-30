import type { Metadata } from 'next';

import { MarketplaceSellerSetupView } from 'src/sections/marketplace/seller/view/seller-setup-view';

export const metadata: Metadata = { title: 'ตั้งค่าร้าน | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceSellerSetupView />;
}
