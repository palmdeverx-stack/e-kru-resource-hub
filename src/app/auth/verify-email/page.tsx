import type { Metadata } from 'next';

import { MarketplaceEmailVerificationView } from 'src/sections/marketplace/auth/view/email-verification-view';

export const metadata: Metadata = {
  title: 'ยืนยันอีเมล | E-KRU Marketplace',
};

export default function Page() {
  return <MarketplaceEmailVerificationView />;
}
