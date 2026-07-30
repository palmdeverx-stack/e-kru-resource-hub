import type { Metadata } from 'next';

import { MarketplaceLegalDocumentView } from 'src/sections/marketplace/legal/view/legal-document-view';

export const metadata: Metadata = {
  title: 'Seller Agreement | E-KRU Marketplace',
  alternates: { canonical: '/seller-agreement' },
};

export default function Page() {
  return <MarketplaceLegalDocumentView documentType="seller_agreement" />;
}
