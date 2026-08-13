import type { Metadata } from 'next';

import { MarketplaceSellerFinanceView } from 'src/sections/marketplace/seller/view/seller-finance-view';

export const metadata: Metadata = { title: 'รายได้ของร้าน | E-KRU Marketplace' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; productId?: string }>;
}) {
  const params = await searchParams;

  return (
    <MarketplaceSellerFinanceView
      initialTab={params.tab === 'sales' || params.tab === 'payouts' ? params.tab : 'income'}
      productId={params.productId?.trim() || undefined}
    />
  );
}
