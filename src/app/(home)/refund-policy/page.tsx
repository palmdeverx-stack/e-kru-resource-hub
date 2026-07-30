import type { Metadata } from 'next';

import { MarketplaceLegalDocumentView } from 'src/sections/marketplace/legal/view/legal-document-view';

export const metadata: Metadata = {
  title: 'Refund Policy | E-KRU Marketplace',
  alternates: { canonical: '/refund-policy' },
};

export default function Page() {
  return <MarketplaceLegalDocumentView documentType="refund_policy" />;
}
