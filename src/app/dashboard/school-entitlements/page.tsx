import type { Metadata } from 'next';

import { SchoolEntitlementsView } from 'src/sections/marketplace/account/view/school-entitlements-view';

export const metadata: Metadata = {
  title: 'สิทธิ์จากโรงเรียน | E-KRU Marketplace',
};

export default function Page() {
  return <SchoolEntitlementsView />;
}
