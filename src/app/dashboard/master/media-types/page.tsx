import type { Metadata } from 'next';

import { MarketplaceMediaTypeManagementView } from 'src/sections/marketplace/admin/view/media-type-management-view';

export const metadata: Metadata = { title: 'ประเภทสื่อ | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceMediaTypeManagementView />;
}
