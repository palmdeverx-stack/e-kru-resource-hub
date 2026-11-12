import type { Metadata } from 'next';

import { OfficialProductsView } from 'src/sections/marketplace/catalog/view/official-products-view';

export const metadata: Metadata = {
  title: 'สื่อและแอปจาก E-KRU | E-KRU Marketplace',
  description:
    'รวมสื่อการสอน เทมเพลต แบบฟอร์ม และแอปจากทีม E-KRU เลือกใช้ได้ทั้งคุณครูและโรงเรียน พร้อมดูรายละเอียดก่อนตัดสินใจ',
  alternates: { canonical: '/official-products' },
};

export default function Page() {
  return <OfficialProductsView />;
}
