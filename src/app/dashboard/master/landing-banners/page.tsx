import type { Metadata } from 'next';

import { LandingBannerManagementView } from 'src/sections/marketplace/admin/view/landing-banner-management-view';

export const metadata: Metadata = { title: 'แบนเนอร์หน้าหลัก | eKru Marketplace' };

export default function Page() {
  return <LandingBannerManagementView />;
}
