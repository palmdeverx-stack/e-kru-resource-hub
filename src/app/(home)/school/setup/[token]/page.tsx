import type { Metadata } from 'next';

import { MarketplaceSchoolSetupView } from 'src/sections/marketplace/checkout/view/school-setup-view';

export const metadata: Metadata = {
  title: 'สร้างโรงเรียนและเปิดใช้งาน License | E-KRU Marketplace',
  robots: { index: false, follow: false, nocache: true },
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <MarketplaceSchoolSetupView token={token} />;
}
