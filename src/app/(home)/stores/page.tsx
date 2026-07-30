import type { Metadata } from 'next';

import { MarketplaceStoreListView } from 'src/sections/marketplace/seller/view/store-list-view';

export const metadata: Metadata = {
  title: 'ร้านค้า | E-KRU Marketplace',
  description: 'ค้นหาร้านค้า ครูผู้สอน และผู้สร้างสื่อที่ผ่านการอนุมัติจาก E-KRU Marketplace',
  alternates: { canonical: '/stores' },
  openGraph: {
    title: 'ร้านค้า | E-KRU Marketplace',
    description: 'ค้นหาร้านค้า ครูผู้สอน และผู้สร้างสื่อที่ผ่านการอนุมัติจาก E-KRU Marketplace',
    url: '/stores',
  },
};

export default function Page() {
  return <MarketplaceStoreListView />;
}
