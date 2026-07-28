import type { Metadata } from 'next';

import { MarketplaceSaleTypeManagementView } from 'src/sections/marketplace/admin/view/sale-type-management-view';

export const metadata: Metadata = { title: 'ประเภทการจำหน่าย | eKru Marketplace' };

export default function Page() {
  return <MarketplaceSaleTypeManagementView />;
}
