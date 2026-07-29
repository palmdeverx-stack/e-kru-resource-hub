import type { Metadata } from 'next';

import { MarketplaceCatalogView } from 'src/sections/marketplace/catalog/view/catalog-view';

export const metadata: Metadata = {
  title: 'สื่อการสอนทั้งหมด | E-KRU Marketplace',
  description: 'เลือกซื้อแผนการสอน ใบงาน แบบทดสอบ และสื่อการเรียนรู้จากชุมชน E-KRU',
};

export default function Page() {
  return <MarketplaceCatalogView />;
}
