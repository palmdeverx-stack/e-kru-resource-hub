import type { Metadata } from 'next';

import { MarketplaceReferralSettingsView } from 'src/sections/marketplace/referrals/view/referral-settings-view';

export const metadata: Metadata = { title: 'ตั้งค่า Referral | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceReferralSettingsView />;
}
