import type { Metadata } from 'next';

import { MarketplaceLandingView } from 'src/sections/marketplace/catalog/view/landing-view';

// ----------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'E-KRU Marketplace | สื่อการสอนจากครูเพื่อครู',
  description: 'ค้นหา ซื้อ และขายสื่อการสอนคุณภาพจากครูและนักสร้างสรรค์ทั่วประเทศ',
};

export default function Page() {
  return <MarketplaceLandingView />;
}
