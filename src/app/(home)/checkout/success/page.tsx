import type { Metadata } from 'next';

import { MarketplaceOrderSuccessView } from 'src/sections/marketplace/checkout/view/order-success-view';

export const metadata: Metadata = { title: 'สั่งซื้อสำเร็จ | eKru Marketplace' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;
  return <MarketplaceOrderSuccessView demo={demo === '1'} />;
}
