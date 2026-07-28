import type { Metadata } from 'next';

import { MarketplaceHomeView } from 'src/sections/marketplace/marketplace-home-view';

// ----------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'eKru Marketplace | สื่อการสอนจากครูเพื่อครู',
  description: 'ค้นหา ซื้อ และขายสื่อการสอนคุณภาพจากครูและนักสร้างสรรค์ทั่วประเทศ',
};

export default function Page() {
  return <MarketplaceHomeView />;
}
