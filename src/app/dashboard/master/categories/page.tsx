import type { Metadata } from 'next';

import { MarketplaceCategoryManagementView } from 'src/sections/marketplace/admin/view/category-management-view';

export const metadata: Metadata = {
  title: 'หมวดหมู่ | E-KRU Marketplace',
  description: 'จัดการหมวดหมู่สินค้า E-KRU Marketplace',
};

export default function Page() {
  return <MarketplaceCategoryManagementView />;
}
