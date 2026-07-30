import type { Metadata } from 'next';

import { MarketplaceReceiptManagementView } from 'src/sections/marketplace/admin/view/receipt-management-view';

export const metadata: Metadata = { title: 'ใบเสร็จรับเงิน | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceReceiptManagementView />;
}
