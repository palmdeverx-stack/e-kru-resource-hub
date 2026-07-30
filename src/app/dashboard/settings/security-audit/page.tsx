import type { Metadata } from 'next';

import { SecurityAuditView } from 'src/sections/marketplace/admin/view/security-audit-view';

export const metadata: Metadata = { title: 'บันทึกความปลอดภัย | E-KRU Marketplace' };

export default function Page() {
  return <SecurityAuditView />;
}
