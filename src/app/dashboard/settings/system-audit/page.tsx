import type { Metadata } from 'next';

import { SystemCapabilityAuditView } from 'src/sections/marketplace/admin/view/system-capability-audit-view';

export const metadata: Metadata = {
  title: 'ภาพรวมและคุณภาพระบบ | E-KRU Marketplace',
};

export default function Page() {
  return <SystemCapabilityAuditView />;
}
