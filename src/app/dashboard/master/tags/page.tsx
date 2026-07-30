import type { Metadata } from 'next';

import { MarketplaceTagManagementView } from 'src/sections/marketplace/admin/view/tag-management-view';

export const metadata: Metadata = { title: 'แท็ก | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceTagManagementView />;
}
