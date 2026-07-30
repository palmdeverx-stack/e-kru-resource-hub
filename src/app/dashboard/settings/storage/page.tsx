import type { Metadata } from 'next';

import { MarketplaceStorageMonitoringView } from 'src/sections/marketplace/admin/view/storage-monitoring-view';

export const metadata: Metadata = { title: 'พื้นที่จัดเก็บ | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceStorageMonitoringView />;
}
