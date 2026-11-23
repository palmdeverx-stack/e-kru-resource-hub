import type { Metadata } from 'next';

import { MarketplaceAdminOrderListView } from 'src/sections/marketplace/admin/view/order-list-view';

export const metadata: Metadata = { title: 'คำสั่งซื้อทั้งหมด | E-KRU Marketplace' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const { id } = await searchParams;
  const orderId = typeof id === 'string' ? id : '';

  return <MarketplaceAdminOrderListView key={orderId} initialOrderId={orderId} />;
}
