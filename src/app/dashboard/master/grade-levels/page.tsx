import type { Metadata } from 'next';

import { MarketplaceGradeLevelManagementView } from 'src/sections/marketplace/admin/view/grade-level-management-view';

export const metadata: Metadata = { title: 'ระดับชั้น | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceGradeLevelManagementView />;
}
