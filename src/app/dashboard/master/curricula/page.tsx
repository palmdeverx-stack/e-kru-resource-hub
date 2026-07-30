import type { Metadata } from 'next';

import { MarketplaceCurriculumManagementView } from 'src/sections/marketplace/admin/view/curriculum-management-view';

export const metadata: Metadata = { title: 'หลักสูตร | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceCurriculumManagementView />;
}
