import type { Metadata } from 'next';

import { MarketplaceReferralView } from 'src/sections/marketplace/referrals/view/referral-view';

export const metadata: Metadata = { title: 'แนะนำเพื่อน | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceReferralView />;
}
