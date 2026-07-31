import type { Metadata } from 'next';

import { OfficialProductsView } from 'src/sections/marketplace/catalog/view/official-products-view';

export const metadata: Metadata = {
  title: 'สินค้าทางการ | E-KRU Marketplace',
  description:
    'เลือกใช้ Templates, Files, Forms, Learning Resources และแอปทางการจาก E-KRU สำหรับบุคคลหรือโรงเรียน',
  alternates: { canonical: '/official-products' },
};

export default function Page() {
  return <OfficialProductsView />;
}
