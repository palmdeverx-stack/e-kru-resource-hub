import type { Metadata } from 'next';

import { MarketplaceSellerBadgeSettingsView } from 'src/sections/marketplace/admin/view/seller-badge-settings-view';

export const metadata: Metadata = { title: 'ตั้งค่ารางวัลผู้ขาย | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceSellerBadgeSettingsView />;
}
