import type { Metadata } from 'next';

import { MarketplacePaymentReviewView } from 'src/sections/marketplace/admin/view/payment-review-view';

export const metadata: Metadata = { title: 'ตรวจสอบการชำระเงิน | eKru Marketplace' };

export default function Page() {
  return <MarketplacePaymentReviewView />;
}
