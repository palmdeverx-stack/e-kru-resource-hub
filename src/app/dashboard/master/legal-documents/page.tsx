import type { Metadata } from 'next';

import { MarketplaceLegalDocumentManagementView } from 'src/sections/marketplace/admin/view/legal-document-management-view';

export const metadata: Metadata = {
  title: 'เอกสารข้อกำหนด | eKru Marketplace',
  description: 'จัดการเอกสารข้อกำหนดและนโยบายของ eKru Marketplace',
};

export default function Page() {
  return <MarketplaceLegalDocumentManagementView />;
}

