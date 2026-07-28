import type { Metadata } from 'next';

import { MarketplaceFinanceSettingsView } from 'src/sections/marketplace/admin/view/finance-settings-view';

export const metadata: Metadata = { title: 'ตั้งค่าการเงิน | eKru Marketplace' };

export default function Page() {
  return <MarketplaceFinanceSettingsView />;
}
