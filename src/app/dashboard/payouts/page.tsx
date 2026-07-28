import type { Metadata } from 'next';

import { MarketplacePayoutManagementView } from 'src/sections/marketplace/admin/view/payout-management-view';

export const metadata: Metadata = { title: 'โอนเงินผู้ขาย | eKru Marketplace' };

export default function Page() {
  return <MarketplacePayoutManagementView />;
}
