import type { Metadata } from 'next';

import { SystemUsersView } from 'src/sections/marketplace/admin/view/system-users-view';

export const metadata: Metadata = { title: 'บัญชีผู้ใช้งาน | E-KRU Marketplace' };

export default function Page() {
  return <SystemUsersView />;
}
