import type { Metadata } from 'next';

import { MarketplaceLegalDocumentManagementView } from 'src/sections/marketplace/admin/view/legal-document-management-view';

export const metadata: Metadata = {
  title: 'เอกสารข้อกำหนด | E-KRU Marketplace',
  description: 'จัดการเอกสารข้อกำหนดและนโยบายของ E-KRU Marketplace',
};

export default function Page() {
  return <MarketplaceLegalDocumentManagementView />;
}
