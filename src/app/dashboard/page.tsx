import type { Metadata } from 'next';

import { MarketplaceDashboardView } from 'src/sections/marketplace/account/view/dashboard-view';

export const metadata: Metadata = {
  title: 'Dashboard | eKru Marketplace',
  description: 'จัดการร้านค้าและสื่อการสอนบน eKru Marketplace',
};

export default function Page() {
  return <MarketplaceDashboardView />;
}
