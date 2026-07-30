import type { Metadata } from 'next';

import { MarketplaceMediaReviewRuleManagementView } from 'src/sections/marketplace/admin/view/media-review-rule-management-view';

export const metadata: Metadata = {
  title: 'การตรวจสอบสื่อ | E-KRU Marketplace',
};

export default function Page() {
  return <MarketplaceMediaReviewRuleManagementView />;
}
