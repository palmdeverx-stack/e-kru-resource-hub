import type { Metadata } from 'next';

import { MarketplaceReportReasonManagementView } from 'src/sections/marketplace/admin/view/report-reason-management-view';

export const metadata: Metadata = {
  title: 'รีวิวและรายงาน | E-KRU Marketplace',
};

export default function Page() {
  return <MarketplaceReportReasonManagementView />;
}
