import type { Metadata } from 'next';

import { MarketplaceDashboardProductsView } from 'src/sections/marketplace/catalog/view/dashboard-products-view';

export const metadata: Metadata = {
  title: 'สินค้าทั้งหมด | E-KRU Marketplace',
  description: 'เลือกซื้อสื่อการสอนจาก E-KRU Marketplace',
};

export default function Page() {
  return <MarketplaceDashboardProductsView />;
}
