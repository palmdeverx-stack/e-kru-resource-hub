import type { Metadata } from 'next';

import { MarketplacePaymentView } from 'src/sections/marketplace/checkout/view/payment-view';

export const metadata: Metadata = {
  title: 'ชำระเงิน | eKru Marketplace',
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MarketplacePaymentView paymentId={id} />;
}
