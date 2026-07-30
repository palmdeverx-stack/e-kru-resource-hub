import type { Metadata } from 'next';

import { MarketplaceSellerApprovalView } from 'src/sections/marketplace/admin/view/seller-approval-view';

export const metadata: Metadata = {
  title: 'คำขอเปิดร้าน | E-KRU Marketplace',
};

export default function Page() {
  return <MarketplaceSellerApprovalView />;
}
