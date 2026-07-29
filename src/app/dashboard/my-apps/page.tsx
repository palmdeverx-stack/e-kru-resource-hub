import type { Metadata } from 'next';

import { UserEntitlementsView } from 'src/sections/marketplace/account/view/user-entitlements-view';

export const metadata: Metadata = {
  title: 'แอปและสิทธิ์ของฉัน | E-KRU Marketplace',
};

export default function Page() {
  return <UserEntitlementsView />;
}
