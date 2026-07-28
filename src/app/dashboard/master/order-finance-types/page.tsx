import type { Metadata } from 'next';

import { MarketplaceOrderFinanceTypeManagementView } from 'src/sections/marketplace/admin/view/order-finance-type-management-view';

export const metadata: Metadata = {
  title: 'คำสั่งซื้อและการเงิน | eKru Marketplace',
};

export default function Page() {
  return <MarketplaceOrderFinanceTypeManagementView />;
}
