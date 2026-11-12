import type { Metadata } from 'next';

import { OfficialProductsView } from 'src/sections/marketplace/catalog/view/official-products-view';

export const metadata: Metadata = {
  title: 'สื่อและเครื่องมือ E-KRU | E-KRU Marketplace',
  description:
    'เลือกสื่อการสอน เทมเพลต แบบฟอร์ม และแอปที่เหมาะกับครูและโรงเรียน',
  alternates: { canonical: '/official-products' },
};

export default function Page() {
  return <OfficialProductsView />;
}
