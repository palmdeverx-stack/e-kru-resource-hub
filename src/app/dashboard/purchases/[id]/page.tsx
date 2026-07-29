import type { Metadata } from 'next';

import { MarketplacePurchaseDetailView } from 'src/sections/marketplace/account/view/purchase-detail-view';

export const metadata: Metadata = {
  title: 'รายละเอียดการซื้อ | eKru Marketplace',
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <MarketplacePurchaseDetailView orderId={id} />;
}
