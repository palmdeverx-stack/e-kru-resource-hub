import type { Metadata } from 'next';

import { getMarketplaceShippingConfig } from 'src/sections/marketplace/shipping/server/config';
import { MarketplaceShippingSettingsView } from 'src/sections/marketplace/shipping/view/shipping-settings-view';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'ตั้งค่าการจัดส่ง | E-KRU Marketplace' };

export default async function Page() {
  const config = await getMarketplaceShippingConfig();
  return <MarketplaceShippingSettingsView initial={config} />;
}
