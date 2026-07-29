import type { Metadata } from 'next';

import { SellerDealsView } from 'src/sections/marketplace/seller/view/seller-deals-view';

export const metadata: Metadata = {
  title: 'ข้อเสนอขายโรงเรียน | E-KRU Marketplace',
};

export default function Page() {
  return <SellerDealsView />;
}
