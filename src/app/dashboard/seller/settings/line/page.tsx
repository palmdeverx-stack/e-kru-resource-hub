import type { Metadata } from 'next';

import { MarketplaceSellerLineSettingsView } from 'src/sections/marketplace/seller/view/seller-line-settings-view';

export const metadata: Metadata = {
  title: 'LINE แจ้งเตือนร้านค้า | E-KRU Marketplace',
};

export default function Page() {
  return <MarketplaceSellerLineSettingsView />;
}
