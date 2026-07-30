import type { Metadata } from 'next';

import { MarketplaceProductApprovalView } from 'src/sections/marketplace/admin/view/product-approval-view';

export const metadata: Metadata = {
  title: 'อนุมัติสินค้า | E-KRU Marketplace',
};

export default function Page() {
  return <MarketplaceProductApprovalView />;
}
