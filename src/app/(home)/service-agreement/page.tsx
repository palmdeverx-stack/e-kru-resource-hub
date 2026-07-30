import type { Metadata } from 'next';

import { MarketplaceLegalDocumentView } from 'src/sections/marketplace/legal/view/legal-document-view';

export const metadata: Metadata = {
  title: 'Service Agreement | E-KRU Marketplace',
  alternates: { canonical: '/service-agreement' },
};

export default function Page() {
  return <MarketplaceLegalDocumentView documentType="seller_agreement" />;
}
