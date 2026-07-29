import type { Metadata } from 'next';

import { MarketplaceSellerSetupView } from 'src/sections/marketplace/seller/view/seller-setup-view';

export const metadata: Metadata = { title: 'แก้ไขข้อมูลร้านค้า | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceSellerSetupView mode="edit" />;
}
