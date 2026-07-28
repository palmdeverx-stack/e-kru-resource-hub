import type { Metadata } from 'next';

import { MarketplaceCategoryManagementView } from 'src/sections/marketplace/admin/view/category-management-view';

export const metadata: Metadata = {
  title: 'หมวดหมู่ | eKru Marketplace',
  description: 'จัดการหมวดหมู่สินค้า eKru Marketplace',
};

export default function Page() {
  return <MarketplaceCategoryManagementView />;
}
